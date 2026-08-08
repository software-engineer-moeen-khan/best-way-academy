<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminExtrasController extends Controller
{
    private function admin(Request $request): void
    {
        abort_unless($request->user()?->role==='admin',403);
    }

    private function uniquePlanSlug(string $source,?int $ignore=null): string
    {
        $base=Str::slug($source)?:'plan';$slug=$base;$i=2;
        while(DB::table('learning_plans')->where('slug',$slug)->when($ignore,fn($q)=>$q->where('id','!=',$ignore))->exists())$slug=$base.'-'.$i++;
        return $slug;
    }

    private function questions(int $assessmentId,bool $withAnswers=true): array
    {
        return DB::table('assessment_questions')->where('assessment_id',$assessmentId)->orderBy('position')->get()->map(function($q)use($withAnswers){
            $row=['id'=>$q->id,'prompt'=>$q->prompt,'options'=>is_string($q->options)?(json_decode($q->options,true)?:[]):($q->options??[]),'explanation'=>$q->explanation,'position'=>(int)$q->position];
            if($withAnswers)$row['correct_answer']=$q->correct_answer;
            return $row;
        })->values()->all();
    }

    public function index(Request $request): JsonResponse
    {
        $this->admin($request);
        $plans=DB::table('learning_plans')->orderBy('position')->orderBy('name')->get()->map(function($plan){
            return [
                'id'=>$plan->id,'name'=>$plan->name,'slug'=>$plan->slug,'billing_period'=>$plan->billing_period,
                'price'=>(int)$plan->price,'description'=>$plan->description,
                'features'=>is_string($plan->features)?(json_decode($plan->features,true)?:[]):($plan->features??[]),
                'active'=>(bool)$plan->active,'position'=>(int)$plan->position,
                'subscription_count'=>(int)DB::table('subscriptions')->where('plan',$plan->slug)->count(),
                'active_subscription_count'=>(int)DB::table('subscriptions')->where('plan',$plan->slug)->where('status','active')->count(),
            ];
        })->values();

        $assessments=DB::table('assessment_sets as a')->join('courses as c','c.id','=','a.course_id')->orderBy('c.title')->orderBy('a.position')
            ->select('a.*','c.slug as course_slug','c.title as course_title')->get()->map(function($a){
                $attempts=DB::table('assessment_attempts')->where('assessment_id',$a->id);
                return [
                    'id'=>$a->id,'course_id'=>$a->course_id,'course_slug'=>$a->course_slug,'course_title'=>$a->course_title,
                    'title'=>$a->title,'type'=>$a->type,'instructions'=>$a->instructions,'passing_score'=>(int)$a->passing_score,
                    'active'=>(bool)$a->active,'position'=>(int)$a->position,
                    'questions'=>$this->questions((int)$a->id,true),
                    'attempt_count'=>(int)(clone $attempts)->count(),
                    'average_score'=>(float)((clone $attempts)->avg('score')??0),
                    'passed_count'=>(int)(clone $attempts)->where('passed',true)->count(),
                ];
            })->values();

        return response()->json(['plans'=>$plans,'assessments'=>$assessments]);
    }

    public function createPlan(Request $request): JsonResponse
    {
        $this->admin($request);$data=$this->planData($request);$slug=$this->uniquePlanSlug($data['slug']?:$data['name']);
        $id=DB::table('learning_plans')->insertGetId([
            'name'=>trim($data['name']),'slug'=>$slug,'billing_period'=>$data['billing_period'],'price'=>$data['price'],
            'description'=>$data['description']??null,'features'=>json_encode($data['features']??[],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),
            'active'=>$data['active'],'position'=>$data['position']??0,'created_at'=>now(),'updated_at'=>now(),
        ]);
        return response()->json(['ok'=>true,'id'=>$id],201);
    }

    public function updatePlan(Request $request,int $plan): JsonResponse
    {
        $this->admin($request);$existing=DB::table('learning_plans')->where('id',$plan)->first();abort_unless($existing,404);$data=$this->planData($request,$plan);
        $slug=$data['slug']?Str::slug($data['slug']):$existing->slug;abort_if(DB::table('learning_plans')->where('slug',$slug)->where('id','!=',$plan)->exists(),422,'Plan slug is already in use.');
        DB::transaction(function()use($plan,$existing,$data,$slug){
            DB::table('learning_plans')->where('id',$plan)->update(['name'=>trim($data['name']),'slug'=>$slug,'billing_period'=>$data['billing_period'],'price'=>$data['price'],'description'=>$data['description']??null,'features'=>json_encode($data['features']??[],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'active'=>$data['active'],'position'=>$data['position']??0,'updated_at'=>now()]);
            if($existing->slug!==$slug)DB::table('subscriptions')->where('plan',$existing->slug)->update(['plan'=>$slug,'updated_at'=>now()]);
        });
        return response()->json(['ok'=>true]);
    }

    private function planData(Request $request,?int $ignore=null): array
    {
        return $request->validate([
            'name'=>['required','string','max:120'],'slug'=>['nullable','string','max:120'],
            'billing_period'=>['required','string','in:monthly,annual,lifetime,custom'],'price'=>['required','integer','min:0','max:100000000'],
            'description'=>['nullable','string','max:5000'],'features'=>['nullable','array','max:50'],'features.*'=>['string','max:500'],
            'active'=>['required','boolean'],'position'=>['nullable','integer','min:0','max:10000'],
        ]);
    }

    public function deletePlan(Request $request,int $plan): JsonResponse
    {
        $this->admin($request);$existing=DB::table('learning_plans')->where('id',$plan)->first();abort_unless($existing,404);
        abort_if(DB::table('subscriptions')->where('plan',$existing->slug)->exists(),409,'This plan has subscription history. Disable it instead of deleting it.');
        DB::table('learning_plans')->where('id',$plan)->delete();return response()->json(['ok'=>true]);
    }

    public function createAssessment(Request $request): JsonResponse
    {
        $this->admin($request);$data=$this->assessmentData($request);$id=$this->saveAssessment(null,$data);return response()->json(['ok'=>true,'id'=>$id],201);
    }

    public function updateAssessment(Request $request,int $assessment): JsonResponse
    {
        $this->admin($request);abort_unless(DB::table('assessment_sets')->where('id',$assessment)->exists(),404);$data=$this->assessmentData($request);$this->saveAssessment($assessment,$data);return response()->json(['ok'=>true]);
    }

    private function assessmentData(Request $request): array
    {
        return $request->validate([
            'course_id'=>['required','integer','exists:courses,id'],'title'=>['required','string','max:255'],
            'type'=>['required','string','in:test,code,lab'],'instructions'=>['nullable','string','max:10000'],
            'passing_score'=>['required','integer','min:0','max:100'],'active'=>['required','boolean'],'position'=>['nullable','integer','min:0','max:10000'],
            'questions'=>['nullable','array','max:100'],'questions.*.prompt'=>['required_with:questions','string','max:5000'],
            'questions.*.options'=>['nullable','array','max:10'],'questions.*.options.*'=>['string','max:1000'],
            'questions.*.correct_answer'=>['nullable','string','max:500'],'questions.*.explanation'=>['nullable','string','max:5000'],
        ]);
    }

    private function saveAssessment(?int $id,array $data): int
    {
        return DB::transaction(function()use($id,$data){
            $row=['course_id'=>$data['course_id'],'title'=>trim($data['title']),'type'=>$data['type'],'instructions'=>$data['instructions']??null,'passing_score'=>$data['passing_score'],'active'=>$data['active'],'position'=>$data['position']??0,'updated_at'=>now()];
            if($id){DB::table('assessment_sets')->where('id',$id)->update($row);DB::table('assessment_questions')->where('assessment_id',$id)->delete();}
            else{$row['created_at']=now();$id=DB::table('assessment_sets')->insertGetId($row);}
            foreach(($data['questions']??[]) as $i=>$q){
                $options=array_values(array_filter(array_map(fn($x)=>trim((string)$x),$q['options']??[]),fn($x)=>$x!==''));
                DB::table('assessment_questions')->insert(['assessment_id'=>$id,'prompt'=>trim($q['prompt']),'options'=>json_encode($options,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),'correct_answer'=>isset($q['correct_answer'])?trim((string)$q['correct_answer']):null,'explanation'=>$q['explanation']??null,'position'=>$i+1,'created_at'=>now(),'updated_at'=>now()]);
            }
            return $id;
        });
    }

    public function deleteAssessment(Request $request,int $assessment): JsonResponse
    {
        $this->admin($request);$deleted=DB::table('assessment_sets')->where('id',$assessment)->delete();abort_unless($deleted,404);return response()->json(['ok'=>true]);
    }
}

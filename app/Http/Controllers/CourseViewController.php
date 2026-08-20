<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourseViewController extends Controller
{
    private function metadata(object $course): array
    {
        if (is_array($course->metadata ?? null)) {
            return $course->metadata;
        }
        $decoded = json_decode((string) ($course->metadata ?? ''), true);
        return is_array($decoded) ? $decoded : [];
    }

    private function udemyExternalUrl(object $course, array $meta): ?string
    {
        if (($meta['external_provider'] ?? null) !== 'udemy') {
            return null;
        }

        $candidate = trim((string) ($course->course_link ?? ''));
        if ($candidate === '' || mb_strlen($candidate) > 2048) {
            return null;
        }

        $parts = parse_url($candidate);
        if (! is_array($parts)) {
            return null;
        }
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $path = (string) ($parts['path'] ?? '');
        if ($scheme !== 'https' || ! ($host === 'udemy.com' || str_ends_with($host, '.udemy.com')) || ! str_starts_with($path, '/course/')) {
            return null;
        }

        parse_str((string) ($parts['query'] ?? ''), $query);
        foreach (array_keys($query) as $key) {
            if (strtolower((string) $key) === 'couponcode') {
                return $candidate;
            }
        }
        return null;
    }

    public function __invoke(Request $request,string $slug): JsonResponse
    {
        $course=DB::table('courses')->where('slug',$slug)->first();
        abort_unless($course,404);

        $user=$request->user();
        $canManage=$user && ($user->role==='admin'||($user->role==='instructor'&&(int)$course->instructor_id===(int)$user->id));
        if($course->status!=='published')abort_unless($canManage,404);
        $enrolled=$user?DB::table('enrollments')->where('user_id',$user->id)->where('course_id',$course->id)->exists():false;
        $fullAccess=$canManage||$enrolled;

        $meta=$this->metadata($course);
        $externalUrl=$this->udemyExternalUrl($course,$meta);
        $out=[
            'id'=>$course->id,'slug'=>$course->slug,'title'=>$course->title,'category'=>$course->category,
            'subtitle'=>$course->subtitle,'description'=>$course->description,'price'=>(int)$course->price,
            'priceLabel'=>'Rs '.number_format((int)$course->price),'status'=>$course->status,
            'rating'=>(float)$course->rating,'students'=>number_format((int)$course->students_count),
            'image'=>$course->image,'badge'=>$course->badge,'learn'=>$meta['learn']??[],'modules'=>$meta['modules']??[],
            'enrolled'=>$enrolled,'can_manage'=>$canManage,
            'external_provider'=>$externalUrl?'udemy':null,'external_url'=>$externalUrl,
            'coupon_code'=>$externalUrl?($meta['coupon_code']??null):null,
            'original_price_label'=>$externalUrl?($meta['original_price_label']??null):null,
        ];

        $out['sections']=DB::table('course_sections')->where('course_id',$course->id)->orderBy('position')->get()->map(function($section)use($fullAccess){
            $lessons=DB::table('lessons')->where('course_section_id',$section->id)->orderBy('position')->get()->map(function($lesson)use($fullAccess){
                $open=$fullAccess||(bool)$lesson->is_preview;
                return [
                    'id'=>$lesson->id,'title'=>$lesson->title,'position'=>(int)$lesson->position,
                    'duration_seconds'=>$lesson->duration_seconds,'is_preview'=>(bool)$lesson->is_preview,
                    'locked'=>!$open,'content'=>$open?$lesson->content:null,'video_url'=>$open?$lesson->video_url:null,
                ];
            })->values();
            return ['id'=>$section->id,'title'=>$section->title,'position'=>(int)$section->position,'lessons'=>$lessons];
        })->values();

        return response()->json($out);
    }
}

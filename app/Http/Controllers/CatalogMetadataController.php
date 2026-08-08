<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CatalogMetadataController extends Controller
{
    public function categories(): JsonResponse
    {
        $rows=DB::table('course_categories')->where('active',true)->orderBy('position')->orderBy('name')->get()->map(function($category){
            return [
                'id'=>$category->id,
                'name'=>$category->name,
                'slug'=>$category->slug,
                'description'=>$category->description,
                'icon'=>$category->icon,
                'position'=>(int)$category->position,
                'course_count'=>(int)DB::table('courses')->where('category',$category->name)->where('status','published')->count(),
            ];
        });
        return response()->json($rows);
    }

    public function platform(): JsonResponse
    {
        $allowed=['site_name','support_email','currency','currency_symbol','allow_registration'];
        $settings=DB::table('platform_settings')->whereIn('key',$allowed)->pluck('value','key')->map(function($value){
            if(!is_string($value))return $value;
            $decoded=json_decode($value,true);
            return json_last_error()===JSON_ERROR_NONE?$decoded:$value;
        });
        return response()->json($settings);
    }
}

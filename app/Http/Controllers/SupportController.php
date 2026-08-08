<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data=$request->validate([
            'name'=>['required','string','max:120'],
            'email'=>['required','email','max:190'],
            'subject'=>['required','string','max:180'],
            'message'=>['required','string','max:10000'],
        ]);

        $id=DB::table('support_requests')->insertGetId([
            'user_id'=>$request->user()?->id,
            'name'=>trim($data['name']),
            'email'=>strtolower(trim($data['email'])),
            'subject'=>trim($data['subject']),
            'message'=>$data['message'],
            'status'=>'open',
            'created_at'=>now(),
            'updated_at'=>now(),
        ]);

        return response()->json([
            'ok'=>true,
            'request_id'=>'SUP-'.str_pad((string)$id,6,'0',STR_PAD_LEFT),
            'message'=>'Your support request has been received.',
        ],201);
    }
}

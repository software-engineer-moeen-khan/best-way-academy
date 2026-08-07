<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lesson extends Model
{
    protected $fillable=['course_section_id','title','content','video_url','position','duration_seconds','is_preview'];
    protected function casts(): array { return ['is_preview'=>'boolean','duration_seconds'=>'integer']; }
    public function section(){ return $this->belongsTo(CourseSection::class,'course_section_id'); }
}

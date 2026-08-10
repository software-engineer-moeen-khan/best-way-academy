<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    protected $fillable = ['slug','instructor_id','title','category','subtitle','description','price','status','rating','students_count','image','badge','course_link','metadata'];
    protected function casts(): array { return ['price'=>'integer','rating'=>'decimal:2','students_count'=>'integer','metadata'=>'array']; }
    public function sections(){ return $this->hasMany(CourseSection::class)->orderBy('position'); }
    public function lessons(){ return $this->hasManyThrough(Lesson::class, CourseSection::class)->orderBy('lessons.position'); }
}

import React from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';

const placeholder = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=70';

const CourseCard = ({ course }) => (
    <Link
        to={`/course/${course.id}`}
        className="group flex flex-col border border-neutral-200 bg-white transition hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
    >
        <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100">
            <img
                src={course.image || placeholder}
                alt={course.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            {course.isFree && (
                <span className="absolute left-0 top-3 bg-[#a435f0] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Free</span>
            )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
            <h3 className="text-base font-bold leading-snug text-[#1c1d1f] line-clamp-2">{course.title}</h3>
            <p className="text-xs text-neutral-600">{course.instructor}</p>
            <div className="flex items-center gap-1 text-xs">
                <span className="font-bold text-[#b4690e]">{course.rating.toFixed(1)}</span>
                <span className="flex text-[#e59819]">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} size={12} fill={i < Math.round(course.rating) ? 'currentColor' : 'none'} strokeWidth={1.5} />
                    ))}
                </span>
                <span className="text-neutral-500">({course.students.toLocaleString()})</span>
            </div>
            <p className="text-xs text-neutral-500">{course.hours} total hours · {course.level}</p>
            <p className="mt-auto pt-2 text-base font-extrabold text-[#1c1d1f]">
                {course.isFree ? 'Free' : course.priceLabel}
            </p>
        </div>
    </Link>
);

export default CourseCard;

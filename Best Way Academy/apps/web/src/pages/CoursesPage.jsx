import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { useCourses } from '@/lib/courses';
import CourseCard from '@/components/CourseCard';
import { Loader2 } from 'lucide-react';

const CoursesPage = () => {
    const { paid, free, loading, error } = useCourses();
    const [params] = useSearchParams();
    const [filter, setFilter] = useState(params.get('filter') === 'free' ? 'free' : 'all');

    const list = useMemo(() => {
        if (filter === 'free') return free;
        if (filter === 'paid') return paid;
        return [...free, ...paid];
    }, [filter, free, paid]);

    return (
        <>
            <Helmet>
                <title>All Courses — Best Way Academy</title>
                <meta name="description" content="Browse every Best Way Academy course: free starter classes and paid career tracks in coding, data, design, marketing and business skills." />
            </Helmet>

            <div className="border-b border-neutral-200 bg-neutral-50">
                <div className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
                    <h1 className="text-3xl font-extrabold text-[#1c1d1f]">All courses</h1>
                    <p className="mt-2 text-neutral-600">{list.length} courses · free and paid, self-paced, lifetime access.</p>
                    <div className="mt-5 flex gap-2">
                        {[['all', 'All'], ['free', 'Free'], ['paid', 'Paid']].map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`border px-4 py-2 text-sm font-bold transition active:scale-[0.98] ${filter === key ? 'border-[#1c1d1f] bg-[#1c1d1f] text-white' : 'border-neutral-300 text-[#1c1d1f] hover:bg-neutral-100'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <section className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
                {loading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#a435f0]" /></div>}
                {error && <p className="text-sm text-red-600">Could not load courses: {error}</p>}
                {!loading && !error && list.length === 0 && <p className="text-neutral-600">No courses in this category yet.</p>}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {list.map((c) => <CourseCard key={c.id} course={c} />)}
                </div>
            </section>
        </>
    );
};

export default CoursesPage;

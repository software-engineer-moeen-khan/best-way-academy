import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useCourses } from '@/lib/courses';
import CourseCard from '@/components/CourseCard';
import { Loader2 } from 'lucide-react';

const topics = ['Web Development', 'Data Science', 'Graphic Design', 'Digital Marketing', 'Spoken English', 'Finance & Excel', 'Freelancing'];

const HomePage = () => {
    const { paid, free, loading, error } = useCourses();

    return (
        <>
            <Helmet>
                <title>Best Way Academy — Online Courses for Real Skills</title>
                <meta name="description" content="Best Way Academy offers paid and free online courses in web development, data science, design, marketing and business communication. Learn at your own pace." />
            </Helmet>

            <section className="bg-[#1c1d1f] text-white">
                <div className="mx-auto grid max-w-[90rem] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
                    <div>
                        <p className="mb-4 inline-block bg-[#a435f0] px-3 py-1 text-xs font-bold uppercase tracking-widest">Learn without limits</p>
                        <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
                            Skills that pay.<br />
                            <span className="text-[#c39bf5]">Taught by people who do the work.</span>
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-neutral-300">
                            Over 60,000 learners study with Best Way Academy. Start with a free course today, or enroll in a full career track with lifetime access.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/courses" className="bg-[#a435f0] px-6 py-3 text-sm font-bold transition hover:bg-[#8710d8] active:scale-[0.98]">Browse all courses</Link>
                            <Link to="/courses?filter=free" className="border border-white/40 px-6 py-3 text-sm font-bold transition hover:bg-white/10 active:scale-[0.98]">Try a free course</Link>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {['12,000+ hours of video', 'Certificate on completion', 'Lifetime access', 'Learn on any device'].map((t) => (
                            <div key={t} className="border border-white/15 bg-white/5 p-5 text-sm font-semibold">{t}</div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="overflow-hidden border-y border-neutral-200 bg-white py-3">
                <div className="flex gap-8 whitespace-nowrap text-sm font-bold uppercase tracking-widest text-neutral-500 [animation:marquee_28s_linear_infinite]">
                    {[...topics, ...topics].map((t, i) => (
                        <span key={`${t}-${i}`}>{t} <span className="text-[#a435f0]">•</span></span>
                    ))}
                </div>
            </div>

            <section className="mx-auto max-w-[90rem] px-4 py-14 sm:px-6">
                <h2 className="text-2xl font-extrabold text-[#1c1d1f]">Free courses to get started</h2>
                <p className="mt-1 text-neutral-600">No payment needed — enroll and start watching instantly.</p>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {free.map((c) => <CourseCard key={c.id} course={c} />)}
                </div>
            </section>

            <section className="mx-auto max-w-[90rem] px-4 pb-20 sm:px-6">
                <h2 className="text-2xl font-extrabold text-[#1c1d1f]">Most popular paid courses</h2>
                <p className="mt-1 text-neutral-600">Full career tracks with projects, quizzes and instructor support.</p>
                {loading && (
                    <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#a435f0]" /></div>
                )}
                {error && <p className="mt-6 text-sm text-red-600">Could not load courses: {error}</p>}
                {!loading && !error && (
                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {paid.slice(0, 8).map((c) => <CourseCard key={c.id} course={c} />)}
                    </div>
                )}
            </section>

            <footer className="border-t border-neutral-200 bg-[#1c1d1f] py-10 text-neutral-400">
                <div className="mx-auto flex max-w-[90rem] flex-wrap gap-6 px-4 text-sm sm:px-6">
                    <div className="min-w-[16rem] flex-1">
                        <p className="text-base font-extrabold text-white">Best Way Academy</p>
                        <p className="mt-2">Practical online education for learners across Pakistan and beyond.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Link to="/courses" className="hover:text-white">All courses</Link>
                        <Link to="/courses?filter=free" className="hover:text-white">Free courses</Link>
                    </div>
                    <div>
                        <p>support@bestwayacademy.com</p>
                        <p className="mt-2">© {new Date().getFullYear()} Best Way Academy</p>
                    </div>
                </div>
            </footer>
        </>
    );
};

export default HomePage;

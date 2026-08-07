import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { getProduct, initializeCheckout } from '@/api/EcommerceApi';
import { toCourse, freeAsCourses } from '@/lib/courses';
import { findFreeCourse } from '@/lib/freeCourses';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Lock, PlayCircle, Loader2, ArrowLeft, Star } from 'lucide-react';

const defaultLessons = [
    { title: 'Welcome and course roadmap', minutes: 8 },
    { title: 'Setting up your tools', minutes: 15 },
    { title: 'Core concepts, part 1', minutes: 24 },
    { title: 'Core concepts, part 2', minutes: 26 },
    { title: 'Hands-on project walkthrough', minutes: 41 },
    { title: 'Quiz, next steps and certificate', minutes: 12 },
];

const CourseDetailPage = () => {
    const { id } = useParams();
    const { toast } = useToast();
    const isFree = id.startsWith('free-');
    const [course, setCourse] = useState(isFree ? freeAsCourses.find((c) => c.id === id) || null : null);
    const [loading, setLoading] = useState(!isFree);
    const [error, setError] = useState(null);
    const [enrolled, setEnrolled] = useState(false);
    const [active, setActive] = useState(0);
    const [buying, setBuying] = useState(false);

    useEffect(() => {
        if (isFree) return;
        let alive = true;
        setLoading(true);
        getProduct(id)
            .then((p) => alive && setCourse(toCourse(p)))
            .catch((err) => alive && setError(err.message || 'Course not found'))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [id, isFree]);

    const lessons = (isFree ? findFreeCourse(id)?.lessons : null) || defaultLessons;

    const handleEnroll = async () => {
        if (isFree) {
            setEnrolled(true);
            toast({ title: 'You are enrolled', description: 'All lessons are unlocked. Happy learning.' });
            return;
        }
        if (!course?.variantId) return;
        setBuying(true);
        try {
            const { url } = await initializeCheckout({
                items: [{ variant_id: course.variantId, quantity: 1 }],
                successUrl: `${window.location.origin}/course/${id}?enrolled=1`,
                cancelUrl: window.location.href,
            });
            window.location.href = url;
        } catch (err) {
            toast({ variant: 'destructive', title: 'Checkout failed', description: err.message || 'Please try again.' });
            setBuying(false);
        }
    };

    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('enrolled') === '1') setEnrolled(true);
    }, []);

    if (loading) {
        return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-[#a435f0]" /></div>;
    }

    if (error || !course) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-24 text-center">
                <p className="text-lg font-bold text-[#1c1d1f]">We could not load this course.</p>
                <p className="mt-2 text-neutral-600">{error || 'It may have been unpublished.'}</p>
                <Link to="/courses" className="mt-6 inline-block bg-[#a435f0] px-5 py-3 text-sm font-bold text-white">Back to all courses</Link>
            </div>
        );
    }

    const unlocked = isFree ? enrolled : enrolled;

    return (
        <>
            <Helmet>
                <title>{`${course.title} — Best Way Academy`}</title>
                <meta name="description" content={course.subtitle || `Enroll in ${course.title} at Best Way Academy.`} />
            </Helmet>

            <section className="bg-[#1c1d1f] text-white">
                <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
                    <div>
                        <Link to="/courses" className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white"><ArrowLeft size={15} /> All courses</Link>
                        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{course.title}</h1>
                        <p className="mt-3 max-w-2xl text-lg text-neutral-300">{course.subtitle}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 font-bold text-[#e59819]"><Star size={14} fill="currentColor" /> {course.rating.toFixed(1)}</span>
                            <span className="text-neutral-300">{course.students.toLocaleString()} students</span>
                            <span className="text-neutral-300">{course.hours} hours · {course.level}</span>
                            <span className="text-neutral-300">Instructor: {course.instructor}</span>
                        </div>
                    </div>
                    <div className="border border-white/15 bg-white p-5 text-[#1c1d1f]">
                        <img src={course.image} alt={course.title} className="mb-4 aspect-[16/9] w-full object-cover" />
                        <p className="text-3xl font-extrabold">{course.isFree ? 'Free' : course.priceLabel}</p>
                        <button
                            onClick={handleEnroll}
                            disabled={buying || (unlocked && isFree)}
                            className="mt-4 w-full bg-[#a435f0] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8710d8] active:scale-[0.99] disabled:opacity-60"
                        >
                            {buying ? 'Redirecting to secure checkout…' : unlocked ? 'You are enrolled' : isFree ? 'Enroll for free' : 'Buy this course'}
                        </button>
                        <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                            <li>Lifetime access to all lessons</li>
                            <li>Certificate of completion</li>
                            <li>30-day money-back guarantee</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="mx-auto grid max-w-[90rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
                <div>
                    <h2 className="text-2xl font-extrabold text-[#1c1d1f]">Course content</h2>
                    <p className="mt-1 text-sm text-neutral-600">{lessons.length} lessons · first lesson is always free to preview</p>
                    <ul className="mt-5 divide-y divide-neutral-200 border border-neutral-200">
                        {lessons.map((l, i) => {
                            const open = unlocked || i === 0;
                            return (
                                <li key={l.title}>
                                    <button
                                        onClick={() => open && setActive(i)}
                                        className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${open ? 'hover:bg-neutral-50' : 'cursor-not-allowed text-neutral-400'} ${active === i && open ? 'bg-neutral-100 font-semibold' : ''}`}
                                    >
                                        {open ? <PlayCircle size={18} className="text-[#a435f0]" /> : <Lock size={16} />}
                                        <span className="flex-1">{i + 1}. {l.title}</span>
                                        <span className="text-xs text-neutral-500">{l.minutes} min</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div>
                    <h2 className="text-2xl font-extrabold text-[#1c1d1f]">Now playing</h2>
                    <div className="mt-5 border border-neutral-200">
                        <div className="grid aspect-video place-items-center bg-[#1c1d1f] text-neutral-300">
                            <div className="text-center">
                                <PlayCircle size={44} className="mx-auto text-[#a435f0]" />
                                <p className="mt-3 px-6 text-sm">{lessons[active].title}</p>
                                {!unlocked && active !== 0 && <p className="mt-1 text-xs">Enroll to unlock this lesson</p>}
                            </div>
                        </div>
                        <div className="p-4 text-sm text-neutral-700">
                            <p className="flex items-center gap-2 font-semibold text-[#1c1d1f]"><CheckCircle size={16} className="text-[#a435f0]" /> Lesson {active + 1} of {lessons.length}</p>
                            <p className="mt-2">{course.description || 'Follow along with downloadable exercise files and a short quiz at the end of each section.'}</p>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
};

export default CourseDetailPage;

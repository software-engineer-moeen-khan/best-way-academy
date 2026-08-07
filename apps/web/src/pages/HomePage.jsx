import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useCourses } from '@/lib/courses';
import CourseCard from '@/components/CourseCard';
import {
    ArrowRight,
    Award,
    CheckCircle2,
    Loader2,
    PlayCircle,
    Quote,
    Sparkles,
    Star,
} from 'lucide-react';

const topics = [
    'Artificial Intelligence',
    'Python',
    'Microsoft Excel',
    'Web Development',
    'Digital Marketing',
    'Graphic Design',
    'Amazon',
];

const testimonials = [
    {
        quote: 'The lessons are easy to follow and focused on skills I can actually use at work.',
        name: 'Ali Raza',
        role: 'Web Development Learner',
    },
    {
        quote: 'I moved from random tutorials to a proper learning path with projects and clear milestones.',
        name: 'Ayesha Khan',
        role: 'Data & AI Learner',
    },
    {
        quote: 'The practical assignments made the biggest difference. I built confidence by doing, not just watching.',
        name: 'Hamza Ahmed',
        role: 'Freelancing Learner',
    },
    {
        quote: 'Best Way Academy helped me refresh my skills without leaving my job or changing my schedule.',
        name: 'Sara Malik',
        role: 'Digital Marketing Learner',
    },
];

const careerCards = [
    {
        title: 'Web Developer',
        meta: '4.8 average rating · 12 courses',
        image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
    },
    {
        title: 'Data Scientist',
        meta: '4.7 average rating · 9 courses',
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',
    },
    {
        title: 'Digital Marketer',
        meta: '4.8 average rating · 8 courses',
        image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80',
    },
];

const skillColumns = [
    ['ChatGPT', 'Generative AI', 'Prompt Engineering'],
    ['Python', 'Web Development', 'Data Science'],
    ['Graphic Design', 'UI/UX Design', 'AutoCAD'],
    ['Project Management', 'Microsoft Power BI', 'Business Communication'],
];

const HomePage = () => {
    const { paid, free, loading, error } = useCourses();
    const trending = [...paid, ...free].slice(0, 5);

    return (
        <>
            <Helmet>
                <title>Best Way Academy — Learn Skills That Move You Forward</title>
                <meta
                    name="description"
                    content="Learn practical technology, business, AI, design and career skills with Best Way Academy."
                />
            </Helmet>

            <main className="bg-white text-[#1c1d1f]">
                <section className="mx-auto max-w-[96rem] px-4 pt-5 sm:px-6">
                    <div className="relative min-h-[360px] overflow-hidden bg-gradient-to-r from-[#28b8ad] via-[#46c7bd] to-[#1ca7a4] md:min-h-[390px]">
                        <div className="absolute -right-24 -top-40 h-[620px] w-[620px] rounded-full bg-[#91e1d8]/75" />
                        <div className="absolute right-[18%] top-[-190px] h-[580px] w-[210px] rotate-[28deg] bg-[#087a80]/80" />
                        <div className="absolute bottom-0 right-0 h-full w-[58%] overflow-hidden">
                            <img
                                src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=85"
                                alt="Student learning online"
                                className="h-full w-full object-cover object-center mix-blend-multiply opacity-90"
                            />
                        </div>

                        <div className="relative z-10 flex min-h-[360px] items-center px-5 py-8 md:min-h-[390px] md:px-12">
                            <div className="w-full max-w-md bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.18)] md:p-8">
                                <p className="text-sm font-bold text-[#6d28d9]">LIMITED-TIME LEARNING OFFER</p>
                                <h1 className="mt-2 text-3xl font-black leading-tight md:text-4xl">Save more on a year of learning</h1>
                                <p className="mt-3 text-sm leading-6 text-neutral-700 md:text-base">
                                    Build real-world skills in AI, development, design and business with flexible online learning.
                                </p>
                                <Link
                                    to="/courses"
                                    className="mt-5 inline-flex items-center gap-2 bg-[#6d28d9] px-5 py-3 text-sm font-bold text-white hover:bg-[#5b21b6]"
                                >
                                    Start now <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-[96rem] px-4 py-10 sm:px-6 md:py-14">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black md:text-3xl">Trending Courses</h2>
                            <p className="mt-1 text-sm text-neutral-600">Popular skills learners are building right now.</p>
                        </div>
                        <Link to="/courses" className="hidden items-center gap-1 text-sm font-bold text-[#6d28d9] hover:underline sm:flex">
                            View all <ArrowRight size={15} />
                        </Link>
                    </div>

                    {loading && (
                        <div className="flex h-48 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
                        </div>
                    )}
                    {error && <p className="mt-6 text-sm text-red-600">Could not load courses: {error}</p>}
                    {!loading && !error && (
                        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                            {trending.map((course) => <CourseCard key={course.id} course={course} />)}
                        </div>
                    )}
                </section>

                <section className="mx-auto max-w-[96rem] px-4 py-4 sm:px-6">
                    <div className="grid overflow-hidden rounded-2xl bg-[#1f2231] text-white lg:grid-cols-[1.05fr_1fr]">
                        <div className="flex flex-col justify-center p-7 md:p-10 lg:p-12">
                            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#6d28d9]">
                                <Sparkles size={18} />
                            </div>
                            <h2 className="text-3xl font-black leading-tight md:text-4xl">Reimagine your career in the AI era</h2>
                            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-300 md:text-base">
                                Learn AI tools and practical workflows that help you work smarter, build faster and stay competitive.
                            </p>
                            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                                {['Learn AI fundamentals', 'Build hands-on projects', 'Use modern productivity tools', 'Earn completion certificates'].map((item) => (
                                    <div key={item} className="flex items-center gap-2">
                                        <CheckCircle2 size={17} className="text-[#c4b5fd]" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                            <Link to="/courses" className="mt-7 inline-flex w-fit items-center gap-2 bg-white px-5 py-3 text-sm font-bold text-[#1f2231] hover:bg-neutral-100">
                                Learn more <ArrowRight size={16} />
                            </Link>
                        </div>
                        <div className="relative min-h-[330px] overflow-hidden bg-gradient-to-br from-[#34bdf2] via-[#7655ee] to-[#b688ff]">
                            <div className="absolute left-10 top-10 h-[78%] w-[38%] rounded-xl bg-gradient-to-b from-[#38bdf8] to-[#7258e8] shadow-2xl" />
                            <img
                                src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85"
                                alt="Professional learning new technology"
                                className="absolute bottom-0 left-[31%] h-[92%] w-[38%] rounded-t-xl object-cover shadow-2xl"
                            />
                            <div className="absolute right-8 top-10 grid h-28 w-28 rotate-6 place-items-center rounded-2xl bg-[#ddd6fe] text-[#6d28d9] shadow-2xl">
                                <Sparkles size={48} />
                            </div>
                            <div className="absolute bottom-8 right-10 grid h-28 w-32 -rotate-6 place-items-center rounded-2xl bg-white/90 text-[#3b2f65] shadow-2xl">
                                <PlayCircle size={48} />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-[96rem] px-4 py-12 sm:px-6">
                    <h2 className="text-2xl font-black md:text-3xl">Skills to transform your career and life</h2>
                    <p className="mt-2 text-neutral-600">Choose a skill, follow a clear path and learn at your own pace.</p>
                    <div className="mt-6 flex gap-6 overflow-x-auto border-b border-neutral-200 pb-3 text-sm font-bold text-neutral-600">
                        {topics.map((topic, index) => (
                            <button key={topic} className={index === 0 ? 'whitespace-nowrap border-b-2 border-[#1c1d1f] pb-3 text-[#1c1d1f]' : 'whitespace-nowrap pb-3 hover:text-[#1c1d1f]'}>
                                {topic}
                            </button>
                        ))}
                    </div>
                    <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                        {[
                            ['AI Essentials', 'Understand generative AI and use it confidently in daily work.', 'Beginner'],
                            ['Prompt Engineering', 'Write better prompts and build repeatable AI workflows.', 'Beginner'],
                            ['AI for Developers', 'Use AI assistants to plan, code, debug and ship faster.', 'Intermediate'],
                            ['AI for Business', 'Automate research, content, reporting and decision support.', 'All levels'],
                        ].map(([title, description, level]) => (
                            <Link key={title} to="/courses" className="group border border-neutral-200 bg-white p-5 hover:shadow-lg">
                                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-[#ede9fe] text-[#6d28d9]">
                                    <Sparkles size={22} />
                                </div>
                                <h3 className="text-lg font-black group-hover:text-[#6d28d9]">{title}</h3>
                                <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
                                <div className="mt-5 flex items-center justify-between text-xs font-semibold text-neutral-500">
                                    <span>{level}</span>
                                    <ArrowRight size={15} />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="border-y border-neutral-200 bg-[#f7f9fa] py-10">
                    <div className="mx-auto max-w-[96rem] px-4 text-center sm:px-6">
                        <p className="text-sm text-neutral-600">Learners build practical skills for companies and teams across the world</p>
                        <div className="mt-7 grid grid-cols-2 gap-5 text-lg font-black tracking-wide text-neutral-500 sm:grid-cols-3 lg:grid-cols-6">
                            {['SAMSUNG', 'CISCO', 'VIMEO', 'P&G', 'CITI', 'ERICSSON'].map((brand) => <span key={brand}>{brand}</span>)}
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-[96rem] px-4 py-14 sm:px-6">
                    <h2 className="text-2xl font-black md:text-3xl">Join others transforming their lives through learning</h2>
                    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {testimonials.map((item) => (
                            <article key={item.name} className="flex min-h-[250px] flex-col border border-neutral-200 p-6">
                                <Quote size={24} fill="currentColor" className="text-[#1c1d1f]" />
                                <p className="mt-5 flex-1 text-sm leading-6 text-neutral-700">{item.quote}</p>
                                <div className="mt-6 border-t border-neutral-200 pt-4">
                                    <p className="font-bold">{item.name}</p>
                                    <p className="text-xs text-neutral-500">{item.role}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[96rem] px-4 py-3 sm:px-6">
                    <div className="grid overflow-hidden rounded-2xl bg-[#1f2231] text-white lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="p-8 md:p-12">
                            <Award size={36} className="text-[#c4b5fd]" />
                            <h2 className="mt-5 text-3xl font-black">Get certified and get ahead in your career</h2>
                            <p className="mt-4 max-w-lg text-sm leading-6 text-neutral-300 md:text-base">
                                Prepare for respected certifications with structured courses, practice and career-focused learning paths.
                            </p>
                            <Link to="/courses" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-white hover:underline">
                                Explore certification prep <ArrowRight size={16} />
                            </Link>
                        </div>
                        <div className="grid gap-4 p-7 sm:grid-cols-3 md:p-10">
                            {[
                                ['CompTIA', 'IT & security'],
                                ['AWS', 'Cloud computing'],
                                ['PMI', 'Project management'],
                            ].map(([title, subtitle]) => (
                                <div key={title} className="flex min-h-[180px] flex-col justify-end rounded-xl bg-[#34384d] p-5">
                                    <div className="mb-auto grid h-12 w-12 place-items-center rounded-lg bg-[#6d28d9] font-black">{title.slice(0, 2)}</div>
                                    <p className="mt-7 font-black">{title}</p>
                                    <p className="mt-1 text-xs text-neutral-300">{subtitle}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-[96rem] px-4 py-14 sm:px-6">
                    <h2 className="text-2xl font-black md:text-3xl">Ready to reimagine your career?</h2>
                    <p className="mt-2 text-neutral-600">Career-focused learning paths built around practical, in-demand skills.</p>
                    <div className="mt-7 grid gap-5 md:grid-cols-3">
                        {careerCards.map((career) => (
                            <Link key={career.title} to="/courses" className="group overflow-hidden border border-neutral-200 bg-white hover:shadow-xl">
                                <div className="aspect-[16/7] overflow-hidden bg-neutral-100">
                                    <img src={career.image} alt={career.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                </div>
                                <div className="p-4">
                                    <h3 className="font-black">{career.title}</h3>
                                    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                                        <Star size={13} fill="currentColor" className="text-[#b4690e]" />
                                        <span>{career.meta}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="bg-[#f7f9fa] py-12">
                    <div className="mx-auto max-w-[96rem] px-4 sm:px-6">
                        <h2 className="text-2xl font-black">Popular Skills</h2>
                        <div className="mt-7 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            {skillColumns.map((column, index) => (
                                <div key={index}>
                                    <p className="mb-4 text-sm font-black text-[#1c1d1f]">
                                        {['AI & Productivity', 'Development', 'Design', 'Business'][index]}
                                    </p>
                                    <div className="space-y-3">
                                        {column.map((skill) => (
                                            <Link key={skill} to="/courses" className="block text-sm font-bold text-[#6d28d9] hover:underline">
                                                {skill} <span aria-hidden="true">›</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-[96rem] px-4 py-14 sm:px-6">
                    <h2 className="text-2xl font-black">Learn AI with guided paths</h2>
                    <div className="mt-6 rounded-xl bg-[#05515b] p-5 md:p-7">
                        <div className="grid gap-4 lg:grid-cols-[1.05fr_3fr]">
                            <div className="flex flex-col justify-between bg-white p-6">
                                <div>
                                    <p className="text-sm font-black text-[#4285f4]">AI Career Certificate</p>
                                    <h3 className="mt-2 text-2xl font-black">Professional AI Certificate</h3>
                                    <p className="mt-3 text-sm leading-6 text-neutral-600">Learn the foundations of AI and apply them through practical activities.</p>
                                </div>
                                <Link to="/courses" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#6d28d9]">
                                    Learn more <ArrowRight size={15} />
                                </Link>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {['AI Fundamentals', 'AI for Productivity', 'AI for Research', 'AI for Marketing'].map((title, index) => (
                                    <Link key={title} to="/courses" className="overflow-hidden bg-white">
                                        <div className="h-28 bg-gradient-to-br from-[#dbeafe] via-[#ddd6fe] to-[#fce7f3] p-4">
                                            <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#6d28d9] shadow">
                                                <Sparkles size={18} />
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <p className="text-sm font-black leading-5">{title}</p>
                                            <p className="mt-2 text-xs text-neutral-500">Course {index + 1} · Beginner friendly</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <footer className="bg-[#1f2231] text-neutral-300">
                    <div className="border-b border-white/10 px-4 py-6 sm:px-6">
                        <div className="mx-auto flex max-w-[96rem] flex-col justify-between gap-4 md:flex-row md:items-center">
                            <p className="font-bold text-white">Top learners choose Best Way Academy to build practical, in-demand skills.</p>
                            <div className="flex flex-wrap gap-6 text-sm font-bold text-neutral-400">
                                <span>Technology</span><span>Business</span><span>Design</span><span>AI</span>
                            </div>
                        </div>
                    </div>
                    <div className="mx-auto grid max-w-[96rem] gap-10 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                        {[
                            ['Explore', ['All courses', 'Free courses', 'Career paths', 'Certificates']],
                            ['Development', ['Web Development', 'Python', 'Data Science', 'Mobile Apps']],
                            ['Business', ['Leadership', 'Marketing', 'Excel', 'Project Management']],
                            ['About', ['About Best Way', 'Contact', 'Help & Support', 'Terms & Privacy']],
                        ].map(([heading, links]) => (
                            <div key={heading}>
                                <p className="text-sm font-black text-white">{heading}</p>
                                <div className="mt-4 space-y-2 text-sm">
                                    {links.map((label) => <Link key={label} to="/courses" className="block hover:text-white">{label}</Link>)}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-white/10">
                        <div className="mx-auto flex max-w-[96rem] flex-col gap-4 px-4 py-7 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2 font-black text-white">
                                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#6d28d9]">B</span>
                                Best Way Academy
                            </div>
                            <p>© {new Date().getFullYear()} Best Way Academy. All rights reserved.</p>
                        </div>
                    </div>
                </footer>
            </main>
        </>
    );
};

export default HomePage;

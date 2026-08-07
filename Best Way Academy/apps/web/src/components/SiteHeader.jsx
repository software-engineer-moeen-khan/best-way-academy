import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { GraduationCap, Search } from 'lucide-react';

const SiteHeader = () => (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-4 px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2 shrink-0">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-[#a435f0] text-white">
                    <GraduationCap size={20} />
                </span>
                <span className="text-lg font-extrabold tracking-tight text-[#1c1d1f]">Best Way <span className="text-[#a435f0]">Academy</span></span>
            </Link>
            <nav className="ml-2 hidden items-center gap-5 text-sm font-medium text-[#1c1d1f] md:flex">
                <NavLink to="/courses" className={({ isActive }) => isActive ? 'text-[#a435f0]' : 'hover:text-[#a435f0]'}>All courses</NavLink>
                <NavLink to="/courses?filter=free" className="hover:text-[#a435f0]">Free courses</NavLink>
            </nav>
            <div className="ml-auto hidden flex-1 max-w-md items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 lg:flex">
                <Search size={16} className="text-neutral-500" />
                <span className="text-sm text-neutral-500">Search anything — design, code, business</span>
            </div>
            <Link
                to="/courses"
                className="ml-auto rounded-md bg-[#1c1d1f] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#a435f0] active:scale-[0.98] lg:ml-4"
            >
                Start learning
            </Link>
        </div>
    </header>
);

export default SiteHeader;

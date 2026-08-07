import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { GraduationCap, Search, ShoppingCart, Globe2, Menu } from 'lucide-react';

const SiteHeader = () => (
    <>
        <div className="bg-[#dff7f4] px-4 py-2 text-center text-xs font-semibold text-[#1c1d1f] sm:text-sm">
            Build job-ready skills with practical courses, projects and lifetime access.
        </div>
        <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white shadow-sm">
            <div className="mx-auto flex h-[72px] max-w-[96rem] items-center gap-3 px-4 sm:px-6">
                <Link to="/" className="flex shrink-0 items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#6d28d9] text-white">
                        <GraduationCap size={20} />
                    </span>
                    <span className="hidden text-lg font-black tracking-tight text-[#1c1d1f] sm:inline">
                        Best Way <span className="text-[#6d28d9]">Academy</span>
                    </span>
                </Link>

                <NavLink to="/courses" className="hidden text-sm font-medium text-[#1c1d1f] hover:text-[#6d28d9] md:block">
                    Explore
                </NavLink>

                <Link
                    to="/courses"
                    className="hidden min-w-0 flex-1 items-center gap-3 rounded-full border border-[#1c1d1f] bg-white px-4 py-2.5 text-sm text-neutral-500 lg:flex"
                >
                    <Search size={18} className="shrink-0" />
                    <span className="truncate">Search for anything</span>
                </Link>

                <nav className="ml-auto hidden items-center gap-5 text-sm text-[#1c1d1f] xl:flex">
                    <NavLink to="/courses" className="hover:text-[#6d28d9]">Courses</NavLink>
                    <NavLink to="/courses?filter=free" className="hover:text-[#6d28d9]">Free learning</NavLink>
                    <Link to="/courses" className="hover:text-[#6d28d9]">Teach on Best Way</Link>
                </nav>

                <Link to="/courses" className="hidden p-2 text-[#1c1d1f] hover:text-[#6d28d9] sm:block" aria-label="Cart">
                    <ShoppingCart size={21} />
                </Link>
                <Link to="/courses" className="hidden border border-[#1c1d1f] px-4 py-2 text-sm font-bold text-[#1c1d1f] hover:bg-neutral-50 md:block">
                    Log in
                </Link>
                <Link to="/courses" className="bg-[#6d28d9] px-4 py-2 text-sm font-bold text-white hover:bg-[#5b21b6]">
                    Sign up
                </Link>
                <button className="hidden border border-[#1c1d1f] p-2 text-[#1c1d1f] md:block" aria-label="Language">
                    <Globe2 size={18} />
                </button>
                <button className="p-2 text-[#1c1d1f] lg:hidden" aria-label="Menu">
                    <Menu size={22} />
                </button>
            </div>
        </header>
    </>
);

export default SiteHeader;

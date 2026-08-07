import React from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import SiteHeader from './components/SiteHeader';
import HomePage from './pages/HomePage';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import { Toaster } from '@/components/ui/toaster';

function App() {
    return (
        <Router>
            <ScrollToTop />
            <SiteHeader />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/course/:id" element={<CourseDetailPage />} />
            </Routes>
            <Toaster />
        </Router>
    );
}

export default App;

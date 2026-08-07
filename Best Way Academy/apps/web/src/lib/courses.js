import { useEffect, useState } from 'react';
import { getProducts, formatCurrency } from '@/api/EcommerceApi';
import { freeCourses } from '@/lib/freeCourses';

const instructors = ['Usman Tariq', 'Sana Iqbal', 'Ali Hassan', 'Maryam Noor', 'Faisal Ahmed', 'Zainab Khan'];

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export const toCourse = (product, i = 0) => {
    const variant = product.variants?.[0];
    const cents = variant?.sale_price_in_cents ?? variant?.price_in_cents ?? product.price_in_cents;
    return {
        id: product.id,
        title: product.title,
        subtitle: product.subtitle || stripHtml(product.description).slice(0, 120),
        description: stripHtml(product.description),
        image: product.image || product.images?.[0]?.url,
        instructor: instructors[i % instructors.length],
        rating: 4.4 + ((i * 7) % 5) / 10,
        students: 3200 + i * 1873,
        hours: 12 + i * 4,
        level: i % 3 === 0 ? 'All levels' : i % 3 === 1 ? 'Beginner' : 'Intermediate',
        priceLabel: formatCurrency(cents, variant?.currency_info) || '',
        variantId: variant?.id,
        isFree: false,
    };
};

export const freeAsCourses = freeCourses.map((c) => ({ ...c, isFree: true, priceLabel: 'Free' }));

export function useCourses() {
    const [paid, setPaid] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        getProducts({ limit: 50 })
            .then((res) => {
                if (!alive) return;
                setPaid(res.products.map(toCourse));
            })
            .catch((err) => alive && setError(err.message || 'Failed to load courses'))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, []);

    return { paid, free: freeAsCourses, loading, error };
}

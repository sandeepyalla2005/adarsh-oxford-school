import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

interface ClassSliderProps {
    activeClass: string;
    onClassChange: (className: string) => void;
    classCounts: Record<string, number>;
    classNames?: string[];
}

const DEFAULT_CLASS_NAMES = [
    'all', 'Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4',
    'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
];

export function ClassSlider({
    activeClass,
    onClassChange,
    classCounts,
    classNames = DEFAULT_CLASS_NAMES
}: ClassSliderProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 200;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="relative group">
            <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-full border border-slate-200/60 backdrop-blur-sm">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => scroll('left')}
                    className="h-8 w-8 rounded-full hover:bg-white hover:text-primary hover:shadow-sm shrink-0 text-slate-400"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div
                    ref={scrollContainerRef}
                    className="class-filter-rail flex-1 overflow-x-auto scrollbar-hide flex items-center gap-1 px-1 py-1"
                >
                    {classNames.map((className) => {
                        const count = classCounts[className] || 0;
                        const isActive = activeClass === className;
                        return (
                            <button
                                key={className}
                                onClick={() => onClassChange(className)}
                                className={`relative px-4 py-1.5 rounded-full text-sm font-bold transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#002147]/20 ${isActive
                                    ? 'text-[#002147]'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeClassTab"
                                        className="absolute inset-0 bg-white rounded-full shadow-sm ring-1 ring-black/5"
                                        initial={false}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 30
                                        }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    {className}
                                    <span className={`text-[10px] font-bold px-1.5 rounded-full transition-colors ${isActive
                                        ? 'bg-[#002147] text-white'
                                        : 'bg-slate-200/70 text-slate-500'
                                        }`}>
                                        {count}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => scroll('right')}
                    className="h-8 w-8 rounded-full hover:bg-white hover:text-primary hover:shadow-sm shrink-0 text-slate-400"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

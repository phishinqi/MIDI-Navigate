import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string | number;
    label: string;
}

interface CustomSelectProps {
    value: string | number;
    onChange: (value: any) => void;
    options: Option[];
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    disabled = false,
    className = '',
    placeholder = 'Select...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (val: string | number) => {
        if (val !== value) {
            onChange(val);
        }
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white transition-all cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 hover:border-white/20'} ${isOpen ? 'border-midi-accent ring-1 ring-midi-accent/50' : ''}`}
            >
                <span className="truncate mr-2">
                    {selectedOption ? selectedOption.label : <span className="text-white/30">{placeholder}</span>}
                </span>
                <ChevronDown size={14} className={`text-white/40 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu - Always mounted but hidden with opacity */}
            <div
                className={`absolute z-[9999] w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto overflow-x-hidden transition-all duration-100 ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
                style={{ transformOrigin: 'top center' }}
            >
                <div className="p-1">
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={() => handleSelect(opt.value)}
                            className={`flex items-center justify-between px-3 py-2 rounded text-sm cursor-pointer transition-colors ${opt.value === value ? 'bg-midi-accent text-black font-medium' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                        >
                            <span className="truncate">{opt.label}</span>
                            {opt.value === value && <Check size={14} className="flex-shrink-0 ml-2" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CustomSelect;

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import "./Dropdown.css"

export default function Dropdown({ options, value, onChange, placeholder, labelKey, valueKey }) {
    const [open, setOpen] = useState(false);
    const ref = useRef();

    useEffect(() => {
        const handler = (e) => { if (!ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o => String(o[valueKey]) === String(value));

    return (
        <div className="custom-select-wrapper" ref={ref}>
            <button
                type="button"
                className={`custom-select-trigger ${open ? 'open' : ''}`}
                onClick={() => setOpen(p => !p)}
            >
                <span className={selected ? '' : 'placeholder'}>
                    {selected ? selected[labelKey] : placeholder}
                </span>
                <ChevronDown size={16} className={`chevron ${open ? 'rotated' : ''}`} />
            </button>
            {open && (
                <ul className="custom-select-menu">
                    {options.map(opt => (
                        <li
                            key={opt[valueKey]}
                            className={`custom-select-option ${String(opt[valueKey]) === String(value) ? 'selected' : ''}`}
                            onClick={() => { onChange(opt[valueKey]); setOpen(false); }}
                        >
                            {opt[labelKey]}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
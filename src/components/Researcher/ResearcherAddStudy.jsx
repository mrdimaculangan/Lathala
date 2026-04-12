import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Upload, ChevronRight, ChevronLeft } from 'lucide-react';
import Navbar from './ResearcherNavbar';
import './ResearcherAddStudy.css';

export default function ResearcherAddStudy() {
    const [currentStep, setCurrentStep] = useState(1);

    // Nullable muna
    const [formData, setFormData] = useState({
        hruRegNo: null,
        dateReg: null,
        studyTitle: null,
        hraAlignment: null,
        hraDescription: null,
        author: null,
        coAuthors: [],
        department: null,
    });

    const steps = [
        { id: 1, label: 'Research Information' },
        { id: 2, label: 'Research Credentials' },
        { id: 3, label: 'File Submission' }
    ];

    const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 3));
    const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

    return (
        <div className="add-study-page">
            <Navbar />

            <div className="form-wrapper">
                <nav className="breadcrumb-container">
                    {steps.map((step) => (
                        <button
                            key={step.id}
                            onClick={() => setCurrentStep(step.id)}
                            className={`breadcrumb-item ${currentStep === step.id ? 'active' : ''}`}
                        >
                            {currentStep === step.id && (
                                <motion.div
                                    layoutId="breadcrumb-blob"
                                    className="blob"
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            )}
                            <span className="step-text">{step.label}</span>
                        </button>
                    ))}
                </nav>

                {/* --- FORM SECTIONS --- */}
                <div className="section-card">
                    <header className="section-header">
                        <h2>SECTION {currentStep}: <i>{steps[currentStep - 1].label}</i></h2>
                    </header>

                    <div className="section-content">
                        {currentStep === 1 && <SectionOne />}
                        {currentStep === 2 && <SectionTwo />}
                        {currentStep === 3 && <SectionThree />}
                    </div>

                    {/* --- NAVIGATION BUTTONS --- */}
                    <div className="navigation-footer">
                        {currentStep > 1 && (
                            <button className="nav-btn prev" onClick={prevStep}>
                                <ChevronLeft size={18} /> Previous
                            </button>
                        )}
                        <div className="spacer"></div>
                        {currentStep < 3 && (
                            <button className="nav-btn next" onClick={nextStep}>
                                Next <ChevronRight size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


const SectionOne = () => (
    <div className="form-grid">
        <div className="input-group">
            <label>HRU Registration No.</label>
            <input type="text" placeholder="Enter HRU Registration No." />
        </div>
        <div className="input-group">
            <label>Date of Registration</label>
            <input type="text" placeholder="Enter Date of Registration" />
        </div>
        <div className="input-group full">
            <label>Title of Study</label>
            <input type="text" placeholder="Enter title of study." />
        </div>
        <div className="input-group full">
            <label>HRA Alignment</label>
            <input type="text" placeholder="Enter HRU Alignment." />
        </div>
        <div className="input-group full">
            <label>HRA Alignment Description</label>
            <textarea rows="4"></textarea>
        </div>
    </div>
);

const SectionTwo = () => (
    <div className="form-grid">
        <div className="input-group full">
            <label>Author</label>
            <input type="text" placeholder="Enter Author Name" />
        </div>
        <div className="input-group full">
            <label>Co-Author/s</label>
            <input type="text" placeholder="Enter Co-Author Names" />
        </div>
        <button className="add-btn"><Plus size={16} /> Add Co-Authors</button>
        <div className="input-group full">
            <label>Department</label>
            <select><option>Choose Department</option></select>
        </div>
    </div>
);

const SectionThree = () => (
    <div className="form-grid">
        <div className="input-group full">
            <label>Initial Documents</label>
            <button className="upload-btn"><Upload size={18} /> Upload Documents</button>
        </div>
        <div className="input-group full">
            <label>Complete Research Submission</label>
            <button className="upload-btn"><Upload size={18} /> Upload Documents</button>
        </div>
    </div>
);
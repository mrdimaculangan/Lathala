import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { motion } from 'framer-motion';
import { UserAuth } from '../../context/AuthContext.jsx';
import { Plus, Upload, ChevronRight, ChevronLeft, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from './ResearcherNavbar';
import './ResearcherAddStudy.css';
import Dropdown from './Dropdown.jsx';
import ResearcherEditStudy from './ResearcherEditStudy';

export default function ResearcherAddStudy() {
    const { firstName, lastName, dbId } = UserAuth(); // gets the current user
    const [currentStep, setCurrentStep] = useState(1);
    const [departments, setDepartments] = useState([]);
    const [hraaList, setHraalList] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const steps = [
        { id: 1, label: 'Research Information' },
        { id: 2, label: 'Research Credentials' },
        { id: 3, label: 'File Submission' },
        { id: 4, label: 'Bioinformatics' },
    ];

    const [formData, setFormData] = useState({
        hru_no: '',
        registration_date: '',
        title: '',
        hraa_id: '',
        description: '',
        author: '',
        department_id: '',
        co_authors: [''],
        files: [],
        involves_bioinformatics: false,
        organism_name: '',
        accession_number: '',
        sequence_type: '',
        data_source: ''
    });

    useEffect(() => {
        async function fetchData() {
            const { data: dept } = await supabase.from('Department').select('*');
            const { data: hraa } = await supabase.from('HRAAlignment').select('*');
            setDepartments(dept || []);
            setHraalList(hraa || []);

            // ── HRU Generation ──
            const { count } = await supabase
                .from('Research')
                .select('*', { count: 'exact', head: true });

            const nextNum = String((count || 0) + 1).padStart(2, '0');
            const now = new Date();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const yyyy = now.getFullYear();
            const hruNo = `ITRMC-HRU${mm}${dd}${yyyy}-${nextNum}`;

            setFormData(prev => ({ ...prev, hru_no: hruNo, registration_date: `${yyyy}-${mm}-${dd}` }));
        }
        fetchData();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addCoAuthor = () => {
        setFormData(prev => ({ ...prev, co_authors: [...prev.co_authors, ''] }));
    };

    const updateCoAuthor = (index, value) => {
        const newAuthors = [...formData.co_authors];
        newAuthors[index] = value;
        setFormData(prev => ({ ...prev, co_authors: newAuthors }));
    };

    const removeCoAuthor = (index) => {
        if (index !== 0) {
            setFormData(prev => ({
                ...prev,
                co_authors: prev.co_authors.filter((_, i) => i !== index)
            }));
        }
    };

    // FILE UPLOADS
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({
                ...prev,
                files: [...prev.files, { file: file, type: 'Research Paper' }] // default
            }));
        }
    };

    const updateFileType = (index, newType) => {
        const updatedFiles = [...formData.files];
        updatedFiles[index].type = newType;
        setFormData(prev => ({ ...prev, files: updatedFiles }));
    };

    const removeFile = (index) => {
        setFormData(prev => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== index)
        }));
    };

    // Validation before submitting to see which fields are empty
    const validateAll = () => {
        if (!formData.title.trim()) {
            toast.error('Section 1: Please enter the Title of Study.');
            setCurrentStep(1); return false;
        }
        if (!formData.hraa_id) {
            toast.error('Section 1: Please select an HRA Alignment.');
            setCurrentStep(1); return false;
        }
        if (!formData.description.trim()) {
            toast.error('Section 1: Please enter the HRA Alignment Description.');
            setCurrentStep(1); return false;
        }
        if (!formData.department_id) {
            toast.error('Section 2: Please select a Department.');
            setCurrentStep(2); return false;
        }
        if (formData.files.length === 0) {
            toast.error('Section 3: Please upload at least one document.');
            setCurrentStep(3); return false;
        }
        if (formData.involves_bioinformatics) {
            if (!formData.organism_name.trim()) {
                toast.error('Section 4: Please enter the Organism Name.');
                setCurrentStep(4); return false;
            }
            if (!formData.accession_number.trim()) {
                toast.error('Section 4: Please enter the Accession Number.');
                setCurrentStep(4); return false;
            }
            if (!formData.sequence_type) {
                toast.error('Section 4: Please select a Sequence Type.');
                setCurrentStep(4); return false;
            }
            if (!formData.data_source.trim()) {
                toast.error('Section 4: Please enter the Database Source.');
                setCurrentStep(4); return false;
            }
        }
        return true;
    };

    // SUBMIT ALL DATA TO SUPABASE
    const handleSubmit = async () => {
        if (!validateAll()) return;
        if (isSubmitting) return;
        setIsSubmitting(true);

        const toastId = toast.loading('Submitting your study, please wait...');

        try {
            let bioId = null;

            // if bioinformatics applies, insert
            if (formData.involves_bioinformatics) {
                console.log(" Attempting to save Bioinformatics...");
                const { data: bioData, error: bioError } = await supabase
                    .from('Bioinformatics')
                    .insert([{
                        organism_name: formData.organism_name,
                        accession_number: formData.accession_number,
                        sequence_type: formData.sequence_type,
                        data_source: formData.data_source
                    }])
                    .select()
                    .single();

                if (bioError) {
                    console.error(" Failed at Bioinformatics:", bioError);
                    throw bioError;
                }
                bioId = bioData.bioinformatics_id;
            }

            const fullName = `${firstName} ${lastName}`;

            // Main research entry
            console.log(" Attempting to save Main Research...");
            const { data: research, error: researchError } = await supabase
                .from('Research')
                .insert([{
                    title: formData.title,
                    registration_date: formData.registration_date,
                    hru_no: formData.hru_no,
                    department_id: formData.department_id,
                    hraa_id: formData.hraa_id,
                    description: formData.description,
                    researcher_id: dbId,
                    bioinformatics_id: bioId,
                    status: 'Pending'
                }])
                .select()
                .single();

            if (researchError) {
                console.error(" Failed at Research Table:", researchError);
                throw researchError;
            }

            // Insert Co-Authors
            const validCoAuthors = formData.co_authors.filter(name => name.trim() !== '');
            if (validCoAuthors.length > 0) {
                const authorData = validCoAuthors.map(name => ({
                    research_id: research.research_id,
                    author_name: name
                }));
                const { error: coAuthorError } = await supabase.from('research_coauthors').insert(authorData);
                if (coAuthorError) throw coAuthorError;
            }

            //  Upload Files & Save their URLs
            for (const item of formData.files) {
                // Create a unique file path so files with the same name don't overwrite each other
                const filePath = `public/${research.research_id}/${Date.now()}_${item.file.name}`;

                // Upload to storage bucket
                const { error: uploadError } = await supabase.storage.from('research-files').upload(filePath, item.file);
                if (uploadError) throw uploadError;

                // Get the public URL
                const { data: urlObj } = supabase.storage.from('research-files').getPublicUrl(filePath);

                // Save the URL to the database table
                const { error: fileRecordError } = await supabase.from('research_files').insert({
                    research_id: research.research_id,
                    file_url: urlObj.publicUrl,
                    file_type: item.type
                });
                if (fileRecordError) throw fileRecordError;
            }

            // Success:
            toast.success('Study submitted successfully!');
            setTimeout(() => { window.location.href = '/researcher-dashboard'; }, 1500);

        } catch (error) {
            console.error("Submission Error:", error);
            toast.error('Error submitting study: ' + error.message);
            setIsSubmitting(false);
        }
    };

    const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 4));
    const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

    return (
        <div className="add-study-page">
            <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
            <Navbar />
            <div className="form-wrapper">
                {/* BREADCRUMBS */}
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

                <div className="section-card">
                    <header className="section-header">
                        <h2>SECTION {currentStep}: <i>{steps[currentStep - 1].label}</i></h2>
                    </header>

                    <div className="section-content">
                        {/* SECTION 1: RESEARCH INFORMATION */}
                        {currentStep === 1 && (
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>HRU Registration No.</label>
                                    <input
                                        name="hru_no"
                                        value={formData.hru_no}
                                        readOnly
                                        className="disabled-input"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Date of Registration</label>
                                    <input
                                        name="registration_date"
                                        value={formData.registration_date}
                                        readOnly
                                        className="disabled-input"
                                    />
                                </div>
                                <div className="input-group full">
                                    <label>Title of Study</label>
                                    <input name="title" placeholder="Enter title of study." onChange={handleInputChange} value={formData.title} />
                                </div>
                                <div className="input-group full">
                                    <label>HRA Alignment</label>
                                    <Dropdown
                                        options={hraaList}
                                        value={formData.hraa_id}
                                        onChange={(val) => setFormData(prev => ({ ...prev, hraa_id: val }))}
                                        placeholder="Select HRA Alignment"
                                        labelKey="hraa_category"
                                        valueKey="hraa_id"
                                    />
                                </div>
                                <div className="input-group full">
                                    <label>HRA Alignment Description</label>
                                    <textarea name="description" rows="4" placeholder="Enter description..." onChange={handleInputChange} value={formData.description}></textarea>
                                </div>
                            </div>
                        )}

                        {/* SECTION 2: RESEARCH CREDENTIALS */}
                        {currentStep === 2 && (
                            <div className="form-grid">
                                <div className="input-group full">
                                    <label>Author</label>
                                    <input
                                        name="author"
                                        value={`${firstName} ${lastName}`}
                                        disabled
                                        className="disabled-input"
                                        placeholder="Logged in user"
                                    />
                                    <small style={{ color: '#666' }}>This study will be submitted under your account.</small>
                                </div>
                                <div className="input-group full">
                                    <label>Co-Author/s</label>
                                    {formData.co_authors.map((auth, index) => (
                                        <div key={index} className="co-author-wrapper">
                                            <input
                                                className="co-author-input"
                                                placeholder="Enter Co-Author Name"
                                                value={auth}
                                                onChange={(e) => updateCoAuthor(index, e.target.value)}
                                                style={{ paddingRight: index !== 0 ? '45px' : '20px' }}
                                            />
                                            {/* Only show the X if it's NOT the first field (index 0) */}
                                            {index !== 0 && (
                                                <button
                                                    type="button"
                                                    className="inner-delete-btn"
                                                    onClick={() => removeCoAuthor(index)}
                                                    title="Remove co-author"
                                                >
                                                    <X size={18} color="#999" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button onClick={addCoAuthor} className="add-btn full">
                                    <Plus size={18} /> Add Co-Authors
                                </button>
                                <div className="input-group full">
                                    <label>Department</label>
                                    <Dropdown
                                        options={departments}
                                        value={formData.department_id}
                                        onChange={(val) => setFormData(prev => ({ ...prev, department_id: val }))}
                                        placeholder="Choose Department"
                                        labelKey="department_name"
                                        valueKey="department_id"
                                    />
                                </div>
                            </div>
                        )}

                        {/* SECTION 3: FILE SUBMISSION */}
                        {currentStep === 3 && (
                            <div className="form-grid">
                                <div className="input-group full">
                                    <label>Upload Documents</label>
                                    <p className="file-hint">
                                        <em>Accepted formats: PDF, JPG, PNG, PPTX, DOCX</em>
                                    </p>
                                    {/* Hidden standard file input */}
                                    <input
                                        type="file"
                                        id="file-upload"
                                        style={{ display: 'none' }}
                                        accept=".pdf,.jpg,.jpeg,.png,.pptx,.docx"
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        type="button"
                                        className="upload-btn"
                                        onClick={() => document.getElementById('file-upload').click()}
                                    >
                                        <Upload size={18} /> Select File to Upload

                                    </button>
                                </div>

                                {/* List of selected files to upload */}
                                {formData.files.length > 0 && (
                                    <div className="input-group full">
                                        <label>Files Ready for Submission</label>
                                        <div className="file-list-container">
                                            {formData.files.map((fileItem, index) => (
                                                <div key={index} className="file-item-row">
                                                    <span className="file-name" title={fileItem.file.name}>
                                                        📄 {fileItem.file.name}
                                                    </span>
                                                    <select
                                                        className="file-type-select"
                                                        value={fileItem.type}
                                                        onChange={(e) => updateFileType(index, e.target.value)}
                                                    >
                                                        <option value="Research Paper">Research Paper</option>
                                                        <option value="PPT">Presentation (PPT)</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(index)}
                                                        className="remove-file-btn"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SECTION 4: BIOINFORMATICS */}
                        {currentStep === 4 && (
                            <div className="form-grid">
                                <div className="input-group full">
                                    <p className="bio-question">Does your study involve Bioinformatics?</p>
                                    <div className="bio-button-group">
                                        <button
                                            type="button"
                                            className={`bio-btn ${formData.involves_bioinformatics === true ? 'active' : ''}`}
                                            onClick={() => setFormData(prev => ({ ...prev, involves_bioinformatics: true }))}
                                        >
                                            Yes
                                        </button>
                                        <button
                                            type="button"
                                            className={`bio-btn ${formData.involves_bioinformatics === false ? 'active' : ''}`}
                                            onClick={() => setFormData(prev => ({
                                                ...prev, involves_bioinformatics: false,
                                                organism_name: '', accession_number: '', sequence_type: '', data_source: ''
                                            }))}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>

                                {/* Conditionally Render Fields */}
                                {formData.involves_bioinformatics && (
                                    <>
                                        <div className="input-group">
                                            <label>Organism Name</label>
                                            <input
                                                name="organism_name"
                                                placeholder="e.g. Homo sapiens"
                                                onChange={handleInputChange}
                                                value={formData.organism_name}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Accession Number</label>
                                            <input
                                                name="accession_number"
                                                placeholder="e.g. NM_000546"
                                                onChange={handleInputChange}
                                                value={formData.accession_number}
                                            />
                                        </div>
                                        <div className="input-group full">
                                            <label>Sequence Type</label>
                                            <Dropdown
                                                options={[
                                                    { label: 'DNA', value: 'DNA' },
                                                    { label: 'RNA', value: 'RNA' },
                                                    { label: 'Protein', value: 'Protein' },
                                                ]}
                                                value={formData.sequence_type}
                                                onChange={(val) => setFormData(prev => ({ ...prev, sequence_type: val }))}
                                                placeholder="Select Sequence Type"
                                                labelKey="label"
                                                valueKey="value"
                                            />
                                        </div>
                                        <div className="input-group full">
                                            <label>Database Source</label>
                                            <input
                                                name="data_source"
                                                placeholder="e.g. NCBI, Ensembl, UniProt"
                                                onChange={handleInputChange}
                                                value={formData.data_source}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="navigation-footer">
                        {currentStep > 1 && (
                            <button className="nav-btn prev" onClick={prevStep}>
                                <ChevronLeft size={18} /> Previous
                            </button>
                        )}
                        <div className="spacer"></div>

                        {currentStep < 4 ? (
                            <button className="nav-btn next" onClick={nextStep}>
                                Next <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                className="nav-btn next submit-btn"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                style={{ opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Study'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
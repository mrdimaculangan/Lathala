import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { motion } from 'framer-motion';
import { UserAuth } from '../../context/AuthContext.jsx';
import { Plus, Upload, ChevronRight, ChevronLeft, X } from 'lucide-react';
import Navbar from './ResearcherNavbar';
import './ResearcherAddStudy.css';

export default function ResearcherAddStudy() {
    const { firstName, lastName, dbId } = UserAuth(); // gets the current user
    const [currentStep, setCurrentStep] = useState(1);
    const [departments, setDepartments] = useState([]);
    const [hraaList, setHraalList] = useState([]);

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

    // SUBMIT ALL DATA TO SUPABASE
    const handleSubmit = async () => {
        const hruRegex = /^ITRMC-HRU\d{8}-\d{2}$/;
        if (!hruRegex.test(formData.hru_no)) {
            alert("Invalid HRU Number. Format must be ITRMC-HRU[Date]-[No] (e.g. ITRMC-HRU01022025-01)");
            return;
        }

        try {
            let bioId = null;

            // if bioinformatics applies, insert
            if (formData.involves_bioinformatics) {
                console.log("📍 Attempting to save Bioinformatics...");
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
                    console.error("❌ Failed at Bioinformatics:", bioError);
                    throw bioError;
                }
                bioId = bioData.bioinformatics_id;
            }

            const fullName = `${firstName} ${lastName}`;

            // Main research entry
            console.log("📍 Attempting to save Main Research...");
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
                    bioinformatics_id: bioId
                }])
                .select()
                .single();

            if (researchError) {
                console.error("❌ Failed at Research Table:", researchError);
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

            alert("Study Submitted Successfully!");
            window.location.href = '/researcher-dashboard'; // go back to dashboard

        } catch (error) {
            console.error("Submission Error:", error);
            alert("Error submitting study: " + error.message);
        }
    };

    const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 4));
    const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

    return (
        <div className="add-study-page">
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
                                    <input name="hru_no" placeholder="Enter HRU Registration No." onChange={handleInputChange} value={formData.hru_no} />
                                </div>
                                <div className="input-group">
                                    <label>Date of Registration</label>
                                    <input type="date" name="registration_date" onChange={handleInputChange} value={formData.registration_date} />
                                </div>
                                <div className="input-group full">
                                    <label>Title of Study</label>
                                    <input name="title" placeholder="Enter title of study." onChange={handleInputChange} value={formData.title} />
                                </div>
                                <div className="input-group full">
                                    <label>HRA Alignment</label>
                                    <select name="hraa_id" onChange={handleInputChange} value={formData.hraa_id}>
                                        <option value="">Select HRA Alignment</option>
                                        {hraaList.map(item => (
                                            <option key={item.hraa_id} value={item.hraa_id}>{item.hraa_category}</option>
                                        ))}
                                    </select>
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
                                    <select name="department_id" onChange={handleInputChange} value={formData.department_id}>
                                        <option value="">Choose Department</option>
                                        {departments.map(d => (
                                            <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* SECTION 3: FILE SUBMISSION */}
                        {currentStep === 3 && (
                            <div className="form-grid">
                                <div className="input-group full">
                                    <label>Upload Documents</label>
                                    {/* Hidden standard file input */}
                                    <input
                                        type="file"
                                        id="file-upload"
                                        style={{ display: 'none' }}
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
                                                        <option value="Poster">Poster</option>
                                                        <option value="Other">Other</option>
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
                                    <label style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px' }}>
                                        Does your study involve Bioinformatics?
                                    </label>
                                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="involves_bioinformatics"
                                                checked={formData.involves_bioinformatics === true}
                                                onChange={() => setFormData(prev => ({ ...prev, involves_bioinformatics: true }))}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            Yes
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="involves_bioinformatics"
                                                checked={formData.involves_bioinformatics === false}
                                                onChange={() => setFormData(prev => ({
                                                    ...prev,
                                                    involves_bioinformatics: false,
                                                    // Clear fields if they change their mind to "No"
                                                    organism_name: '',
                                                    accession_number: '',
                                                    sequence_type: '',
                                                    data_source: ''
                                                }))}
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            No
                                        </label>
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
                                            <select name="sequence_type" onChange={handleInputChange} value={formData.sequence_type}>
                                                <option value="">Select Sequence Type</option>
                                                <option value="DNA">DNA</option>
                                                <option value="RNA">RNA</option>
                                                <option value="Protein">Protein</option>
                                                <option value="Other">Other</option>
                                            </select>
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
                            <button className="nav-btn next submit-btn" onClick={handleSubmit}>
                                Submit Study
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
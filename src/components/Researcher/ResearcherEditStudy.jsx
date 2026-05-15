import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { UserAuth } from '../../context/AuthContext.jsx';
import { X, Upload, Plus } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from './ResearcherNavbar';
import Dropdown from './Dropdown.jsx';
import './ResearcherAddStudy.css'; // reuse same styles
import './ResearcherEditStudy.css';

export default function ResearcherEditStudy() {
    const { researchId } = useParams();
    const navigate = useNavigate();
    const { firstName, lastName, dbId } = UserAuth();

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [hraaList, setHraaList] = useState([]);

    // Existing files from DB (already uploaded)
    const [existingFiles, setExistingFiles] = useState([]);
    const [filesToDelete, setFilesToDelete] = useState([]); // file_ids to remove
    // New files to upload
    const [newFiles, setNewFiles] = useState([]); // [{file, type}]

    const [formData, setFormData] = useState({
        title: '',
        department_id: '',
        hraa_id: '',
        co_authors: [''],
    });

    useEffect(() => {
        async function loadData() {
            // Load dropdowns
            const [{ data: dept }, { data: hraa }] = await Promise.all([
                supabase.from('Department').select('*'),
                supabase.from('HRAAlignment').select('*'),
            ]);
            setDepartments(dept || []);
            setHraaList(hraa || []);

            // Load existing research
            const { data: research, error } = await supabase
                .from('Research')
                .select(`
                    *,
                    research_files ( id, file_url, file_type ),
                    research_coauthors ( id, author_name )
                `)
                .eq('research_id', researchId)
                .single();

            if (error || !research) {
                toast.error('Could not load research.');
                navigate('/researcher-dashboard');
                return;
            }

            // Guard: only Pending can be edited
            const cleanStatus = research.status?.replace(/"/g, '').trim();
            if (cleanStatus !== 'Pending') {
                toast.error('This submission can no longer be edited.');
                navigate('/researcher-dashboard');
                return;
            }

            setFormData({
                title: research.title || '',
                department_id: research.department_id || '',
                hraa_id: research.hraa_id || '',
                co_authors: research.research_coauthors?.length > 0
                    ? research.research_coauthors.map(c => c.author_name)
                    : [''],
            });

            setExistingFiles(research.research_files || []);
            setLoading(false);
        }

        loadData();
    }, [researchId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const updateCoAuthor = (index, value) => {
        const updated = [...formData.co_authors];
        updated[index] = value;
        setFormData(prev => ({ ...prev, co_authors: updated }));
    };

    const addCoAuthor = () => {
        setFormData(prev => ({ ...prev, co_authors: [...prev.co_authors, ''] }));
    };

    const removeCoAuthor = (index) => {
        if (index === 0) return;
        setFormData(prev => ({
            ...prev,
            co_authors: prev.co_authors.filter((_, i) => i !== index)
        }));
    };

    const markExistingFileForDeletion = (fileId) => {
        setFilesToDelete(prev => [...prev, fileId]);
        setExistingFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const handleNewFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewFiles(prev => [...prev, { file, type: 'Research Paper' }]);
        }
    };

    const updateNewFileType = (index, newType) => {
        const updated = [...newFiles];
        updated[index].type = newType;
        setNewFiles(updated);
    };

    const removeNewFile = (index) => {
        setNewFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!formData.title.trim()) {
            toast.error('Title is required.'); return;
        }
        if (!formData.department_id) {
            toast.error('Please select a department.'); return;
        }
        if (!formData.hraa_id) {
            toast.error('Please select an HRA Alignment.'); return;
        }
        if (existingFiles.length === 0 && newFiles.length === 0) {
            toast.error('At least one file must remain attached.'); return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading('Saving changes...');

        try {
            // 1. Update main Research row
            const { error: updateError } = await supabase
                .from('Research')
                .update({
                    title:         formData.title,
                    department_id: formData.department_id,
                    hraa_id:       formData.hraa_id,
                })
                .eq('research_id', researchId);

            if (updateError) throw updateError;

            // 2. Replace co-authors: delete all, reinsert
            await supabase
                .from('research_coauthors')
                .delete()
                .eq('research_id', researchId);

            const validCoAuthors = formData.co_authors.filter(n => n.trim() !== '');
            if (validCoAuthors.length > 0) {
                const { error: coError } = await supabase
                    .from('research_coauthors')
                    .insert(validCoAuthors.map(name => ({
                        research_id: Number(researchId),
                        author_name: name
                    })));
                if (coError) throw coError;
            }

            // 3. Delete marked existing files from DB
            //    (storage cleanup optional — skip for now to avoid complexity)
            if (filesToDelete.length > 0) {
                const { error: delError } = await supabase
                    .from('research_files')
                    .delete()
                    .in('id', filesToDelete);
                if (delError) throw delError;
            }

            // 4. Upload new files
            for (const item of newFiles) {
                const filePath = `public/${researchId}/${Date.now()}_${item.file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('research-files')
                    .upload(filePath, item.file);
                if (uploadError) throw uploadError;

                const { data: urlObj } = supabase.storage
                    .from('research-files')
                    .getPublicUrl(filePath);

                const { error: fileRecordError } = await supabase
                    .from('research_files')
                    .insert({
                        research_id: Number(researchId),
                        file_url:    urlObj.publicUrl,
                        file_type:   item.type
                    });
                if (fileRecordError) throw fileRecordError;
            }

            toast.dismiss(toastId);
            toast.success('Submission updated successfully!');
            setTimeout(() => navigate('/researcher-dashboard'), 1500);

        } catch (err) {
            toast.dismiss(toastId);
            toast.error('Error saving: ' + err.message);
            setIsSubmitting(false);
        }
    };

    if (loading) return (
        <div className="add-study-page">
            <Navbar />
            <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
                Loading submission...
            </div>
        </div>
    );

    return (
        <div className="add-study-page">
            <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
            <Navbar />

            <div className="form-wrapper">
                <div className="edit-page-header">
                    <h1>Edit Submission</h1>
                    <p>You may edit the title, co-authors, department, HRA alignment, and attached files. Other details are locked after submission.</p>
                </div>

                <div className="section-card">
                    <header className="section-header">
                        <h2>RESEARCH DETAILS</h2>
                    </header>

                    <div className="section-content">
                        <div className="form-grid">

                            {/* Title */}
                            <div className="input-group full">
                                <label>Title of Study</label>
                                <input
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    placeholder="Enter title of study"
                                />
                            </div>

                            {/* HRA Alignment */}
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

                            {/* Department */}
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

                            {/* Author (locked) */}
                            <div className="input-group full">
                                <label>Primary Author</label>
                                <input
                                    value={`${firstName} ${lastName}`}
                                    disabled
                                    className="disabled-input"
                                />
                                <small style={{ color: '#94a3b8' }}>Primary author cannot be changed.</small>
                            </div>

                            {/* Co-Authors */}
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
                                        {index !== 0 && (
                                            <button
                                                type="button"
                                                className="inner-delete-btn"
                                                onClick={() => removeCoAuthor(index)}
                                            >
                                                <X size={18} color="#999" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addCoAuthor} className="add-btn full" type="button">
                                    <Plus size={18} /> Add Co-Author
                                </button>
                            </div>

                            {/* Existing Files */}
                            <div className="input-group full">
                                <label>Currently Attached Files</label>
                                {existingFiles.length === 0 ? (
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                                        No existing files (all removed).
                                    </p>
                                ) : (
                                    <div className="file-list-container">
                                        {existingFiles.map((file) => {
                                            const fileName = file.file_url
                                                ? file.file_url.split('/').pop().split('_').slice(1).join('_')
                                                : 'Unknown file';
                                            return (
                                                <div key={file.id} className="file-item-row existing-file">
                                                    <span className="file-name" title={fileName}>
                                                        📄 {fileName}
                                                    </span>
                                                    <span className="file-type-label">{file.file_type}</span>
                                                    <button
                                                        type="button"
                                                        className="remove-file-btn"
                                                        onClick={() => markExistingFileForDeletion(file.id)}
                                                        title="Remove this file"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* New Files */}
                            <div className="input-group full">
                                <label>Add New Files</label>
                                <p className="file-hint">
                                    <em>Accepted formats: PDF, JPG, PNG, PPTX, DOCX</em>
                                </p>
                                <input
                                    type="file"
                                    id="edit-file-upload"
                                    style={{ display: 'none' }}
                                    accept=".pdf,.jpg,.jpeg,.png,.pptx,.docx"
                                    onChange={handleNewFileChange}
                                />
                                <button
                                    type="button"
                                    className="upload-btn"
                                    onClick={() => document.getElementById('edit-file-upload').click()}
                                >
                                    <Upload size={18} /> Select File to Upload
                                </button>

                                {newFiles.length > 0 && (
                                    <div className="file-list-container" style={{ marginTop: '12px' }}>
                                        {newFiles.map((item, index) => (
                                            <div key={index} className="file-item-row">
                                                <span className="file-name" title={item.file.name}>
                                                    📄 {item.file.name}
                                                </span>
                                                <select
                                                    className="file-type-select"
                                                    value={item.type}
                                                    onChange={(e) => updateNewFileType(index, e.target.value)}
                                                >
                                                    <option value="Research Paper">Research Paper</option>
                                                    <option value="PPT">Presentation (PPT)</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    className="remove-file-btn"
                                                    onClick={() => removeNewFile(index)}
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="navigation-footer">
                        <button
                            className="nav-btn prev"
                            onClick={() => navigate('/researcher-dashboard')}
                            type="button"
                        >
                            Cancel
                        </button>
                        <div className="spacer"></div>
                        <button
                            className="nav-btn next submit-btn"
                            onClick={handleSave}
                            disabled={isSubmitting}
                            style={{ opacity: isSubmitting ? 0.6 : 1 }}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
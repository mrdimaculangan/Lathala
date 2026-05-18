import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, UserPlus } from 'lucide-react';
import './AdminAddUser.css';

const steps = [
    { id: 1, label: 'Account Info' },
    { id: 2, label: 'Personal Details' },
];

const initialForm = {
    email: '',
    password: '',
    confirm_password: '',
    first_name: '',
    last_name: '',
    role: '',
    contact_number: '',
    occupation: '',
};

export default function AdminAddUser({ onClose, onSuccess }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const validateStep1 = () => {
        if (!formData.email || !formData.password || !formData.confirm_password || !formData.role) {
            setError('Please fill in all required fields.');
            return false;
        }
        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match.');
            return false;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        if (!formData.first_name || !formData.last_name) {
            setError('First name and last name are required.');
            return false;
        }
        return true;
    };

    const nextStep = () => {
        if (currentStep === 1 && !validateStep1()) return;
        setCurrentStep(prev => Math.min(prev + 1, 2));
    };

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async () => {
        if (!validateStep2()) return;
        setLoading(true);
        setError('');

        try {
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: formData.email,
                password: formData.password,
                email_confirm: true,
                user_metadata: {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    role: formData.role,
                    contact_number: formData.contact_number,
                    occupation: formData.occupation,
                }
            });

            if (authError) {
                console.error('Auth error:', authError);
                console.error('Auth error details:', JSON.stringify(authError, null, 2));
                throw authError;
            }

            console.log('User created successfully:', authData);
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error adding user:', err);
            console.error('Error details:', JSON.stringify(err, null, 2));
            setError(err.message || 'Failed to add user.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="modal-container"
                    initial={{ opacity: 0, y: 40, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="modal-header">
                        <div className="modal-title">
                            <UserPlus size={22} />
                            <h2>Add New User</h2>
                        </div>
                        <button className="modal-close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Breadcrumb */}
                    <nav className="modal-breadcrumb">
                        {steps.map(step => (
                            <button
                                key={step.id}
                                onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                                className={`modal-breadcrumb-item ${currentStep === step.id ? 'active' : ''} ${step.id < currentStep ? 'completed' : ''}`}
                            >
                                {currentStep === step.id && (
                                    <motion.div
                                        layoutId="modal-blob"
                                        className="modal-blob"
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <span>{step.label}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Section Header */}
                    <div className="modal-section-header">
                        <h3>SECTION {currentStep}: <i>{steps[currentStep - 1].label}</i></h3>
                    </div>

                    {/* Form Content */}
                    <div className="modal-body">
                        {error && <div className="modal-error">{error}</div>}

                        {currentStep === 1 && (
                            <div className="form-grid">
                                <div className="input-group full">
                                    <label>Email Address <span className="required">*</span></label>
                                    <input
                                        name="email"
                                        type="email"
                                        placeholder="Enter email address"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Password <span className="required">*</span></label>
                                    <input
                                        name="password"
                                        type="password"
                                        placeholder="Min. 6 characters"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Confirm Password <span className="required">*</span></label>
                                    <input
                                        name="confirm_password"
                                        type="password"
                                        placeholder="Re-enter password"
                                        value={formData.confirm_password}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="input-group full">
                                    <label>Role <span className="required">*</span></label>
                                    <select name="role" value={formData.role} onChange={handleInputChange}>
                                        <option value="">Select a role</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Evaluator">Evaluator</option>
                                        <option value="Researcher">Researcher</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="form-grid">
                                <div className="input-group">
                                    <label>First Name <span className="required">*</span></label>
                                    <input
                                        name="first_name"
                                        placeholder="Enter first name"
                                        value={formData.first_name}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Last Name <span className="required">*</span></label>
                                    <input
                                        name="last_name"
                                        placeholder="Enter last name"
                                        value={formData.last_name}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Contact Number</label>
                                    <input
                                        name="contact_number"
                                        placeholder="e.g. 09123456789"
                                        value={formData.contact_number}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Occupation</label>
                                    <input
                                        name="occupation"
                                        placeholder="e.g. Doctor, Researcher"
                                        value={formData.occupation}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Navigation */}
                    <div className="modal-footer">
                        {currentStep > 1 && (
                            <button className="modal-nav-btn prev" onClick={prevStep}>
                                <ChevronLeft size={18} /> Previous
                            </button>
                        )}
                        <div className="spacer" />
                        {currentStep < 2 ? (
                            <button className="modal-nav-btn next" onClick={nextStep}>
                                Next <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                className="modal-nav-btn submit"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? 'Adding User...' : 'Add User'}
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
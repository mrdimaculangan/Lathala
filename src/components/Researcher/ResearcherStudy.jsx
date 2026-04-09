import { UserAuth } from '../../context/AuthContext';
import Logout from '../Logout';
import Navbar from './ResearcherNavbar';

export default function ResearcherStudy() {
    const { session, userRole, firstName, lastName } = UserAuth();

    return (
        <Navbar />

    );
}
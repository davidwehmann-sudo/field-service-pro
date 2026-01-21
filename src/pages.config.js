import Authorizations from './pages/Authorizations';
import CustomerPortal from './pages/CustomerPortal';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import FieldTech from './pages/FieldTech';
import Invoices from './pages/Invoices';
import PartsInventory from './pages/PartsInventory';
import PartsOrders from './pages/PartsOrders';
import PayInvoice from './pages/PayInvoice';
import ServiceReports from './pages/ServiceReports';
import TechnicianChat from './pages/TechnicianChat';
import Home from './pages/Home';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Authorizations": Authorizations,
    "CustomerPortal": CustomerPortal,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "FieldTech": FieldTech,
    "Invoices": Invoices,
    "PartsInventory": PartsInventory,
    "PartsOrders": PartsOrders,
    "PayInvoice": PayInvoice,
    "ServiceReports": ServiceReports,
    "TechnicianChat": TechnicianChat,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
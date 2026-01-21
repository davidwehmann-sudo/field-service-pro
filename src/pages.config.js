import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import PartsOrders from './pages/PartsOrders';
import ServiceReports from './pages/ServiceReports';
import Authorizations from './pages/Authorizations';
import CustomerPortal from './pages/CustomerPortal';
import TechnicianChat from './pages/TechnicianChat';
import PartsInventory from './pages/PartsInventory';
import PayInvoice from './pages/PayInvoice';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Customers": Customers,
    "Dashboard": Dashboard,
    "Invoices": Invoices,
    "PartsOrders": PartsOrders,
    "ServiceReports": ServiceReports,
    "Authorizations": Authorizations,
    "CustomerPortal": CustomerPortal,
    "TechnicianChat": TechnicianChat,
    "PartsInventory": PartsInventory,
    "PayInvoice": PayInvoice,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
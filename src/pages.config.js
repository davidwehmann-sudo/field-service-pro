import Authorizations from './pages/Authorizations';
import CustomerPortal from './pages/CustomerPortal';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import FieldTech from './pages/FieldTech';
import FinancialExports from './pages/FinancialExports';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import PartsInventory from './pages/PartsInventory';
import PartsOrders from './pages/PartsOrders';
import PayInvoice from './pages/PayInvoice';
import ServiceReports from './pages/ServiceReports';
import Sitemap from './pages/Sitemap';
import ImportData from './pages/ImportData';
import SecurityChecklist from './pages/SecurityChecklist';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Authorizations": Authorizations,
    "CustomerPortal": CustomerPortal,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "FieldTech": FieldTech,
    "FinancialExports": FinancialExports,
    "Home": Home,
    "Invoices": Invoices,
    "PartsInventory": PartsInventory,
    "PartsOrders": PartsOrders,
    "PayInvoice": PayInvoice,
    "ServiceReports": ServiceReports,
    "Sitemap": Sitemap,
    "ImportData": ImportData,
    "SecurityChecklist": SecurityChecklist,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
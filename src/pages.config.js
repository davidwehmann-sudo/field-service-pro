import Authorizations from './pages/Authorizations';
import CustomerPortal from './pages/CustomerPortal';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import FieldTech from './pages/FieldTech';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import PartsInventory from './pages/PartsInventory';
import PartsOrders from './pages/PartsOrders';
import PayInvoice from './pages/PayInvoice';
import PaymentLog from './pages/PaymentLog';
import SecurityChecklist from './pages/SecurityChecklist';
import ServiceReports from './pages/ServiceReports';
import Sitemap from './pages/Sitemap';
import VehicleExpenses from './pages/VehicleExpenses';
import DataManagement from './pages/DataManagement';
import AuthorizeService from './pages/AuthorizeService';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Authorizations": Authorizations,
    "CustomerPortal": CustomerPortal,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "FieldTech": FieldTech,
    "Home": Home,
    "Invoices": Invoices,
    "PartsInventory": PartsInventory,
    "PartsOrders": PartsOrders,
    "PayInvoice": PayInvoice,
    "PaymentLog": PaymentLog,
    "SecurityChecklist": SecurityChecklist,
    "ServiceReports": ServiceReports,
    "Sitemap": Sitemap,
    "VehicleExpenses": VehicleExpenses,
    "DataManagement": DataManagement,
    "AuthorizeService": AuthorizeService,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
import Authorizations from './pages/Authorizations';
import AuthorizeService from './pages/AuthorizeService';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import DataManagement from './pages/DataManagement';
import FieldTech from './pages/FieldTech';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import PartsInventory from './pages/PartsInventory';
import PartsOrders from './pages/PartsOrders';
import PaymentLog from './pages/PaymentLog';
import SecurityChecklist from './pages/SecurityChecklist';
import ServiceReports from './pages/ServiceReports';
import Sitemap from './pages/Sitemap';
import VehicleExpenses from './pages/VehicleExpenses';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Authorizations": Authorizations,
    "AuthorizeService": AuthorizeService,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "DataManagement": DataManagement,
    "FieldTech": FieldTech,
    "Home": Home,
    "Invoices": Invoices,
    "PartsInventory": PartsInventory,
    "PartsOrders": PartsOrders,
    "PaymentLog": PaymentLog,
    "SecurityChecklist": SecurityChecklist,
    "ServiceReports": ServiceReports,
    "Sitemap": Sitemap,
    "VehicleExpenses": VehicleExpenses,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
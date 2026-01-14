import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import ServiceReports from './pages/ServiceReports';
import PartsOrders from './pages/PartsOrders';
import Invoices from './pages/Invoices';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Customers": Customers,
    "ServiceReports": ServiceReports,
    "PartsOrders": PartsOrders,
    "Invoices": Invoices,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AgExemptions from './pages/AgExemptions';
import Authorizations from './pages/Authorizations';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import DataManagement from './pages/DataManagement';
import FieldTech from './pages/FieldTech';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import Jobs from './pages/Jobs';
import OwnVehicles from './pages/OwnVehicles';
import PartsInventory from './pages/PartsInventory';
import PartsOrders from './pages/PartsOrders';
import PaymentLog from './pages/PaymentLog';
import ReceiptUpload from './pages/ReceiptUpload';
import ReceiptViewer from './pages/ReceiptViewer';
import RequestAuthorization from './pages/RequestAuthorization';
import ServiceReports from './pages/ServiceReports';
import SignReport from './pages/SignReport';
import Sitemap from './pages/Sitemap';
import TechnicianPayroll from './pages/TechnicianPayroll';
import VehicleExpenses from './pages/VehicleExpenses';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AgExemptions": AgExemptions,
    "Authorizations": Authorizations,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "DataManagement": DataManagement,
    "FieldTech": FieldTech,
    "Home": Home,
    "Invoices": Invoices,
    "Jobs": Jobs,
    "OwnVehicles": OwnVehicles,
    "PartsInventory": PartsInventory,
    "PartsOrders": PartsOrders,
    "PaymentLog": PaymentLog,
    "ReceiptUpload": ReceiptUpload,
    "ReceiptViewer": ReceiptViewer,
    "RequestAuthorization": RequestAuthorization,
    "ServiceReports": ServiceReports,
    "SignReport": SignReport,
    "Sitemap": Sitemap,
    "TechnicianPayroll": TechnicianPayroll,
    "VehicleExpenses": VehicleExpenses,
}

export const pagesConfig = {
    mainPage: "RequestAuthorization",
    Pages: PAGES,
    Layout: __Layout,
};
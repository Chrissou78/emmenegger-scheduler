import { Outlet } from "react-router-dom";
export function AppShell() { return (<div style={{display:"flex",minHeight:"100vh"}}><main style={{flex:1}}><Outlet /></main></div>); }

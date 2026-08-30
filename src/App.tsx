/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { PdfImport } from "./pages/PdfImport";
import { EmData } from "./pages/EmData";
import { TrendAnalysis } from "./pages/TrendAnalysis";
import { OosResults } from "./pages/OosResults";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="import" element={<PdfImport />} />
          <Route path="data" element={<EmData />} />
          <Route path="trends" element={<TrendAnalysis />} />
          <Route path="oos" element={<OosResults />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

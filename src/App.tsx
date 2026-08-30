/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { PdfImport } from "./pages/PdfImport";
import { EmData } from "./pages/EmData";
import { TrendAnalysis } from "./pages/TrendAnalysis";
import { OosResults } from "./pages/OosResults";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="import" element={<PdfImport />} />
            <Route path="data" element={<EmData />} />
            <Route path="em-data" element={<EmData />} />
            <Route path="em_data" element={<EmData />} />
            <Route path="trends" element={<TrendAnalysis />} />
            <Route path="oos" element={<OosResults />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

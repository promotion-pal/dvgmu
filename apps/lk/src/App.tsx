import { BrowserRouter } from "react-router";
import { IndexPage } from "./page";
import { Sidebar } from "@/widgets/layout/sidebar";

function App() {
  return (
    <BrowserRouter>
      <Sidebar>
        <IndexPage />
      </Sidebar>
    </BrowserRouter>
  );
}

export default App

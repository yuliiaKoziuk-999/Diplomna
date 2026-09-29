import React from "react"
import ReactDOM from "react-dom/client"

import "./index.css"
import { RouterProvider, createBrowserRouter } from "react-router-dom"

import { ApolloProvider } from "@apollo/client"
import { MantineProvider } from "@mantine/core"
import { ModalsProvider } from "@mantine/modals"
import { client } from "./apolloClient"
import Home from "./pages/Home.tsx"
import VerifiableSearchDemo from "./pages/VerifiableSearchDemo.tsx"
import Pricing from "./pages/Pricing.tsx"
import Account from "./pages/Account.tsx"
import Product from "./pages/Product.tsx"

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    children: [
      {
        path: "/chatrooms/:id",
      },
    ],
  },
  {
    path: "/verifiable-search",
    element: <VerifiableSearchDemo />,
  },
  {
    path: "/product",
    element: <Product />,
  },
  {
    path: "/pricing",
    element: <Pricing />,
  },
  {
    path: "/account",
    element: <Account />,
  },
])

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider withGlobalStyles withNormalizeCSS>
      <ModalsProvider>
        <ApolloProvider client={client}>
          <RouterProvider router={router} />
        </ApolloProvider>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
)

// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import "./index.css";

import AuthProvider from "@/lib/AuthContext";
import ProtectedRoute from "@/lib/ProtectedRoute";

import Layout from "./layouts/Layout.jsx";
import Login from "./pages/Login.jsx";
import Feed from "./pages/Feed.jsx";
import AddEvent from "./pages/events/AddEvent.jsx";
import EventDetail from "./pages/events/EventDetail.jsx";
import Profile from "./pages/Profile.jsx";
import MapView from "./pages/MapView.jsx";
import Friends from "./pages/Friends.jsx";
import Wishlist from "./pages/wishlist/Wishlist.jsx";
import AddWish from "./pages/wishlist/AddWish.jsx";
import WishDetail from "./pages/wishlist/WishDetail.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protégé */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/feed" replace />} />
            <Route path="feed" element={<Feed />} />
            <Route path="addevent" element={<AddEvent />} />
            <Route path="eventdetail" element={<EventDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="mapview" element={<MapView />} />
            <Route path="friends" element={<Friends />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="wishlist/add" element={<AddWish />} />
            <Route path="wishlist/detail" element={<WishDetail />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

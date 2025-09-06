import React, { useState, useEffect } from "react";
import {
  Plus,
  Car,
  TrendingUp,
  Download,
  Edit2,
  Trash2,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from "../lib/supabase";

export default function MileageTracker({ user }) {
  const { isDark, toggleTheme } = useTheme();
  const [motorcycles, setMotorcycles] = useState([]);
  const [fillups, setFillups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddBike, setShowAddBike] = useState(false);
  const [showAddFillup, setShowAddFillup] = useState(false);
  const [editingFillup, setEditingFillup] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'bike'|'fillup', id: string, name: string }

  const [newBike, setNewBike] = useState({ name: "", model: "" });
  const [newFillup, setNewFillup] = useState({
    motorcycleId: "",
    date: new Date().toISOString().split("T")[0],
    odometer: "",
    liters: "",
    cost: "",
    pumpName: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch motorcycles
      const { data: motorcyclesData, error: motorcyclesError } = await supabase
        .from("motorcycles")
        .select("*")
        .order("created_at", { ascending: true });

      if (motorcyclesError) throw motorcyclesError;

      // Fetch fillups
      const { data: fillupsData, error: fillupsError } = await supabase
        .from("fillups")
        .select("*")
        .order("date", { ascending: true });

      if (fillupsError) throw fillupsError;

      setMotorcycles(motorcyclesData || []);
      setFillups(fillupsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Error loading data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addMotorcycle = async () => {
    if (!newBike.name.trim()) return;

    try {
      const { data, error } = await supabase
        .from("motorcycles")
        .insert([
          {
            user_id: user.id,
            name: newBike.name.trim(),
            model: newBike.model.trim(),
          },
        ])
        .select();

      if (error) throw error;

      setMotorcycles([...motorcycles, data[0]]);
      setNewBike({ name: "", model: "" });
      setShowAddBike(false);
    } catch (error) {
      console.error("Error adding motorcycle:", error);
      alert("Error adding motorcycle: " + error.message);
    }
  };

  const addFillup = async () => {
    if (
      !newFillup.motorcycleId ||
      !newFillup.odometer ||
      (!newFillup.liters && !newFillup.cost)
    ) {
      return;
    }

    try {
      let liters = parseFloat(newFillup.liters) || 0;
      let cost = parseFloat(newFillup.cost) || 0;

      // Estimate missing values
      if (!liters && cost) liters = cost / 100;
      if (!cost && liters) cost = liters * 100;

      const { data, error } = await supabase
        .from("fillups")
        .insert([
          {
            user_id: user.id,
            motorcycle_id: newFillup.motorcycleId,
            date: newFillup.date,
            odometer: parseInt(newFillup.odometer),
            liters: liters,
            cost: cost,
            pump_name: newFillup.pumpName.trim() || null,
          },
        ])
        .select();

      if (error) throw error;

      setFillups([...fillups, data[0]]);
      setNewFillup({
        motorcycleId: newFillup.motorcycleId,
        date: new Date().toISOString().split("T")[0],
        odometer: "",
        liters: "",
        cost: "",
        pumpName: "",
      });
      setShowAddFillup(false);
    } catch (error) {
      console.error("Error adding fillup:", error);
      alert("Error adding fillup: " + error.message);
    }
  };

  const updateFillup = async () => {
    if (!editingFillup) return;

    try {
      const { data, error } = await supabase
        .from("fillups")
        .update({
          date: editingFillup.date,
          odometer: parseInt(editingFillup.odometer),
          liters: parseFloat(editingFillup.liters),
          cost: parseFloat(editingFillup.cost),
          pump_name: editingFillup.pump_name?.trim() || null,
        })
        .eq("id", editingFillup.id)
        .select();

      if (error) throw error;

      setFillups(fillups.map((f) => (f.id === editingFillup.id ? data[0] : f)));
      setEditingFillup(null);
    } catch (error) {
      console.error("Error updating fillup:", error);
      alert("Error updating fillup: " + error.message);
    }
  };

  const deleteBike = async (id) => {
    try {
      // First delete all fillups for this bike
      const { error: fillupsError } = await supabase
        .from("fillups")
        .delete()
        .eq("motorcycle_id", id);

      if (fillupsError) throw fillupsError;

      // Then delete the motorcycle
      const { error: bikeError } = await supabase
        .from("motorcycles")
        .delete()
        .eq("id", id);

      if (bikeError) throw bikeError;

      setMotorcycles(motorcycles.filter((m) => m.id !== id));
      setFillups(fillups.filter((f) => f.motorcycle_id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting motorcycle:", error);
      alert("Error deleting motorcycle: " + error.message);
    }
  };

  const deleteFillup = async (id) => {
    try {
      const { error } = await supabase.from("fillups").delete().eq("id", id);

      if (error) throw error;

      setFillups(fillups.filter((f) => f.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting fillup:", error);
      alert("Error deleting fillup: " + error.message);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Error signing out: " + error.message);
    }
  };

  // Helper functions (same as original)
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN");
  };

  const calculateMileage = (currentFillup, previousFillup) => {
    if (!previousFillup) return null;
    const distance = currentFillup.odometer - previousFillup.odometer;
    const mileage = distance / previousFillup.liters;
    return mileage > 0 ? mileage.toFixed(2) : null;
  };

  const getMotorcycleFillups = (motorcycleId) => {
    return fillups
      .filter((f) => f.motorcycle_id === motorcycleId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const calculateAverageMileage = (motorcycleId) => {
    const bikeFillups = getMotorcycleFillups(motorcycleId);
    if (bikeFillups.length < 2) return null;

    let totalDistance = 0;
    let totalFuel = 0;

    for (let i = 1; i < bikeFillups.length; i++) {
      const distance = bikeFillups[i].odometer - bikeFillups[i - 1].odometer;
      totalDistance += distance;
      totalFuel += bikeFillups[i - 1].liters;
    }

    return totalFuel > 0 ? (totalDistance / totalFuel).toFixed(2) : null;
  };

  const exportToCSV = () => {
    if (fillups.length === 0) {
      alert("No data to export!");
      return;
    }

    const headers = [
      "Date",
      "Motorcycle",
      "Odometer (km)",
      "Liters",
      "Cost (INR)",
      "Mileage (km/l)",
      "Pump Name",
    ];

    const sortedFillups = [...fillups].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    const rows = sortedFillups.map((fillup) => {
      const bike = motorcycles.find((b) => b.id === fillup.motorcycle_id);
      const bikeFillups = getMotorcycleFillups(fillup.motorcycle_id);
      const fillupIndex = bikeFillups.findIndex((f) => f.id === fillup.id);
      const previousFillup =
        fillupIndex > 0 ? bikeFillups[fillupIndex - 1] : null;
      const mileage = calculateMileage(fillup, previousFillup) || "N/A";

      return [
        `"${formatDate(fillup.date)}"`,
        `"${bike?.name || "Unknown"} (${bike?.model || "Unknown"})"`,
        fillup.odometer,
        fillup.liters.toFixed(2),
        fillup.cost.toFixed(2),
        mileage,
        `"${fillup.pump_name || "Not specified"}"`,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `motorcycle_mileage_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                Miley - Mileage Tracker
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Welcome, {user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={signOut}
                className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Car className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Bikes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{motorcycles.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Fillups</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fillups.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Download className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ₹{fillups.reduce((sum, f) => sum + f.cost, 0).toFixed(0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={() => setShowAddBike(true)}
            className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </button>
          <button
            onClick={() => setShowAddFillup(true)}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            disabled={motorcycles.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Fillup
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            disabled={fillups.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>

        {/* Add Motorcycle Modal */}
        {showAddBike && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Add New Vehicle</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Bike Name (e.g., My Honda)"
                  value={newBike.name}
                  onChange={(e) =>
                    setNewBike({ ...newBike, name: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <input
                  type="text"
                  placeholder="Model (e.g., CB Shine)"
                  value={newBike.model}
                  onChange={(e) =>
                    setNewBike({ ...newBike, model: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAddBike(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addMotorcycle}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Fillup Modal */}
        {showAddFillup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Add New Fillup</h3>
              <div className="space-y-4">
                <select
                  value={newFillup.motorcycleId}
                  onChange={(e) =>
                    setNewFillup({ ...newFillup, motorcycleId: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Motorcycle</option>
                  {motorcycles.map((bike) => (
                    <option key={bike.id} value={bike.id}>
                      {bike.name} ({bike.model})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={newFillup.date}
                  onChange={(e) =>
                    setNewFillup({ ...newFillup, date: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  placeholder="Odometer Reading (km)"
                  value={newFillup.odometer}
                  onChange={(e) =>
                    setNewFillup({ ...newFillup, odometer: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Fuel (Liters)"
                  value={newFillup.liters}
                  onChange={(e) =>
                    setNewFillup({ ...newFillup, liters: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Cost (INR)"
                  value={newFillup.cost}
                  onChange={(e) =>
                    setNewFillup({ ...newFillup, cost: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <input
                  type="text"
                  placeholder="Pump Name (Optional)"
                  value={newFillup.pumpName}
                  onChange={(e) =>
                    setNewFillup({ ...newFillup, pumpName: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAddFillup(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addFillup}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add Fillup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Delete{" "}
                  {deleteConfirm.type === "bike" ? "Motorcycle" : "Fillup"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {deleteConfirm.type === "bike"
                    ? `Are you sure you want to delete "${deleteConfirm.name}"? This will also delete all associated fillup records. This action cannot be undone.`
                    : `Are you sure you want to delete this fillup record? This action cannot be undone.`}
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      deleteConfirm.type === "bike"
                        ? deleteBike(deleteConfirm.id)
                        : deleteFillup(deleteConfirm.id)
                    }
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete{" "}
                    {deleteConfirm.type === "bike" ? "Motorcycle" : "Fillup"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Fillup Modal */}
        {editingFillup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Edit Fillup</h3>
              <div className="space-y-4">
                <input
                  type="date"
                  value={editingFillup.date}
                  onChange={(e) =>
                    setEditingFillup({ ...editingFillup, date: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  placeholder="Odometer Reading (km)"
                  value={editingFillup.odometer}
                  onChange={(e) =>
                    setEditingFillup({
                      ...editingFillup,
                      odometer: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Fuel (Liters)"
                  value={editingFillup.liters}
                  onChange={(e) =>
                    setEditingFillup({
                      ...editingFillup,
                      liters: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Cost (INR)"
                  value={editingFillup.cost}
                  onChange={(e) =>
                    setEditingFillup({ ...editingFillup, cost: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <input
                  type="text"
                  placeholder="Pump Name (Optional)"
                  value={editingFillup.pump_name || ""}
                  onChange={(e) =>
                    setEditingFillup({
                      ...editingFillup,
                      pump_name: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingFillup(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateFillup}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Motorcycles and Fillups Display */}
        {motorcycles.length > 0 && (
          <div className="space-y-6">
            {motorcycles.map((motorcycle) => {
              const bikeFillups = getMotorcycleFillups(motorcycle.id);
              const avgMileage = calculateAverageMileage(motorcycle.id);

              return (
                <div
                  key={motorcycle.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6"
                >
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                        {motorcycle.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">{motorcycle.model}</p>
                      {avgMileage && (
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                          Average Mileage: {avgMileage} km/l
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Fillups</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {bikeFillups.length}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            type: "bike",
                            id: motorcycle.id,
                            name: `${motorcycle.name} (${motorcycle.model})`,
                          })
                        }
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Motorcycle"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {bikeFillups.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>No fillups recorded for this vehicle</p>
                      <button
                        onClick={() => {
                          setNewFillup({
                            ...newFillup,
                            motorcycleId: motorcycle.id,
                          });
                          setShowAddFillup(true);
                        }}
                        className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Add First Fillup
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 text-gray-900 dark:text-white">Date</th>
                            <th className="text-left py-2 text-gray-900 dark:text-white">Odometer</th>
                            <th className="text-left py-2 text-gray-900 dark:text-white">Liters</th>
                            <th className="text-left py-2 text-gray-900 dark:text-white">Cost</th>
                            <th className="text-left py-2 text-gray-900 dark:text-white">Mileage</th>
                            <th className="text-left py-2 text-gray-900 dark:text-white">Pump</th>
                            <th className="text-left py-2 text-gray-900 dark:text-white">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bikeFillups.map((fillup, index) => {
                            const previousFillup =
                              index > 0 ? bikeFillups[index - 1] : null;
                            const mileage = calculateMileage(
                              fillup,
                              previousFillup
                            );

                            return (
                              <tr
                                key={fillup.id}
                                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                              >
                                <td className="py-2 text-gray-900 dark:text-gray-300">
                                  {formatDate(fillup.date)}
                                </td>
                                <td className="py-2 text-gray-900 dark:text-gray-300">{fillup.odometer} km</td>
                                <td className="py-2 text-gray-900 dark:text-gray-300">
                                  {fillup.liters.toFixed(2)} L
                                </td>
                                <td className="py-2 text-gray-900 dark:text-gray-300">
                                  ₹{fillup.cost.toFixed(2)}
                                </td>
                                <td className="py-2 text-gray-900 dark:text-gray-300">
                                  {mileage ? `${mileage} km/l` : "N/A"}
                                </td>
                                <td className="py-2 text-gray-900 dark:text-gray-300">
                                  {fillup.pump_name || "Not specified"}
                                </td>
                                <td className="py-2">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setEditingFillup(fillup)}
                                      className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setDeleteConfirm({
                                          type: "fillup",
                                          id: fillup.id,
                                          name: `${formatDate(
                                            fillup.date
                                          )} fillup`,
                                        })
                                      }
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {motorcycles.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <Car className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-600 dark:text-gray-300 mb-2">
              No Motorcycles Added
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Start by adding your first motorcycle to begin tracking mileage
            </p>
            <button
              onClick={() => setShowAddBike(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Bike
            </button>
          </div>
        )}
      </div>
      </div>
  );
}

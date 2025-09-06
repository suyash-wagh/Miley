import React, { useState, useEffect } from 'react'
import { Plus, Car, TrendingUp, Download, Edit2, Trash2, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function MileageTracker({ user }) {
  const [motorcycles, setMotorcycles] = useState([])
  const [fillups, setFillups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddBike, setShowAddBike] = useState(false)
  const [showAddFillup, setShowAddFillup] = useState(false)
  const [editingFillup, setEditingFillup] = useState(null)
  
  const [newBike, setNewBike] = useState({ name: '', model: '' })
  const [newFillup, setNewFillup] = useState({
    motorcycleId: '',
    date: new Date().toISOString().split('T')[0],
    odometer: '',
    liters: '',
    cost: '',
    pumpName: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch motorcycles
      const { data: motorcyclesData, error: motorcyclesError } = await supabase
        .from('motorcycles')
        .select('*')
        .order('created_at', { ascending: true })

      if (motorcyclesError) throw motorcyclesError

      // Fetch fillups
      const { data: fillupsData, error: fillupsError } = await supabase
        .from('fillups')
        .select('*')
        .order('date', { ascending: true })

      if (fillupsError) throw fillupsError

      setMotorcycles(motorcyclesData || [])
      setFillups(fillupsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Error loading data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const addMotorcycle = async () => {
    if (!newBike.name.trim()) return

    try {
      const { data, error } = await supabase
        .from('motorcycles')
        .insert([
          {
            user_id: user.id,
            name: newBike.name.trim(),
            model: newBike.model.trim()
          }
        ])
        .select()

      if (error) throw error

      setMotorcycles([...motorcycles, data[0]])
      setNewBike({ name: '', model: '' })
      setShowAddBike(false)
    } catch (error) {
      console.error('Error adding motorcycle:', error)
      alert('Error adding motorcycle: ' + error.message)
    }
  }

  const addFillup = async () => {
    if (!newFillup.motorcycleId || !newFillup.odometer || (!newFillup.liters && !newFillup.cost)) {
      return
    }

    try {
      let liters = parseFloat(newFillup.liters) || 0
      let cost = parseFloat(newFillup.cost) || 0

      // Estimate missing values
      if (!liters && cost) liters = cost / 100
      if (!cost && liters) cost = liters * 100

      const { data, error } = await supabase
        .from('fillups')
        .insert([
          {
            user_id: user.id,
            motorcycle_id: newFillup.motorcycleId,
            date: newFillup.date,
            odometer: parseInt(newFillup.odometer),
            liters: liters,
            cost: cost,
            pump_name: newFillup.pumpName.trim() || null
          }
        ])
        .select()

      if (error) throw error

      setFillups([...fillups, data[0]])
      setNewFillup({
        motorcycleId: newFillup.motorcycleId,
        date: new Date().toISOString().split('T')[0],
        odometer: '',
        liters: '',
        cost: '',
        pumpName: ''
      })
      setShowAddFillup(false)
    } catch (error) {
      console.error('Error adding fillup:', error)
      alert('Error adding fillup: ' + error.message)
    }
  }

  const updateFillup = async () => {
    if (!editingFillup) return

    try {
      const { data, error } = await supabase
        .from('fillups')
        .update({
          date: editingFillup.date,
          odometer: parseInt(editingFillup.odometer),
          liters: parseFloat(editingFillup.liters),
          cost: parseFloat(editingFillup.cost),
          pump_name: editingFillup.pump_name?.trim() || null
        })
        .eq('id', editingFillup.id)
        .select()

      if (error) throw error

      setFillups(fillups.map(f => f.id === editingFillup.id ? data[0] : f))
      setEditingFillup(null)
    } catch (error) {
      console.error('Error updating fillup:', error)
      alert('Error updating fillup: ' + error.message)
    }
  }

  const deleteFillup = async (id) => {
    if (!confirm('Are you sure you want to delete this fillup?')) return

    try {
      const { error } = await supabase
        .from('fillups')
        .delete()
        .eq('id', id)

      if (error) throw error

      setFillups(fillups.filter(f => f.id !== id))
    } catch (error) {
      console.error('Error deleting fillup:', error)
      alert('Error deleting fillup: ' + error.message)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Error signing out:', error)
      alert('Error signing out: ' + error.message)
    }
  }

  // Helper functions (same as original)
  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN')
  }

  const calculateMileage = (currentFillup, previousFillup) => {
    if (!previousFillup) return null
    const distance = currentFillup.odometer - previousFillup.odometer
    const mileage = distance / previousFillup.liters
    return mileage > 0 ? mileage.toFixed(2) : null
  }

  const getMotorcycleFillups = (motorcycleId) => {
    return fillups
      .filter(f => f.motorcycle_id === motorcycleId)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  const calculateAverageMileage = (motorcycleId) => {
    const bikeFillups = getMotorcycleFillups(motorcycleId)
    if (bikeFillups.length < 2) return null
    
    let totalDistance = 0
    let totalFuel = 0
    
    for (let i = 1; i < bikeFillups.length; i++) {
      const distance = bikeFillups[i].odometer - bikeFillups[i-1].odometer
      totalDistance += distance
      totalFuel += bikeFillups[i-1].liters
    }
    
    return totalFuel > 0 ? (totalDistance / totalFuel).toFixed(2) : null
  }

  const exportToCSV = () => {
    if (fillups.length === 0) {
      alert('No data to export!')
      return
    }

    const headers = ['Date', 'Motorcycle', 'Odometer (km)', 'Liters', 'Cost (INR)', 'Mileage (km/l)', 'Pump Name']
    
    const sortedFillups = [...fillups].sort((a, b) => new Date(a.date) - new Date(b.date))
    
    const rows = sortedFillups.map(fillup => {
      const bike = motorcycles.find(b => b.id === fillup.motorcycle_id)
      const bikeFillups = getMotorcycleFillups(fillup.motorcycle_id)
      const fillupIndex = bikeFillups.findIndex(f => f.id === fillup.id)
      const previousFillup = fillupIndex > 0 ? bikeFillups[fillupIndex - 1] : null
      const mileage = calculateMileage(fillup, previousFillup) || 'N/A'
      
      return [
        `"${formatDate(fillup.date)}"`,
        `"${bike?.name || 'Unknown'} (${bike?.model || 'Unknown'})"`,
        fillup.odometer,
        fillup.liters.toFixed(2),
        fillup.cost.toFixed(2),
        mileage,
        `"${fillup.pump_name || 'Not specified'}"`
      ]
    })

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `motorcycle_mileage_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Motorcycle Mileage Tracker</h1>
              <p className="text-gray-600">Welcome, {user.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Car className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Bikes</p>
                <p className="text-2xl font-bold">{motorcycles.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Fillups</p>
                <p className="text-2xl font-bold">{fillups.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center">
              <Download className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold">₹{fillups.reduce((sum, f) => sum + f.cost, 0).toFixed(0)}</p>
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
            Add Motorcycle
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
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Add New Motorcycle</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Bike Name (e.g., My Honda)"
                  value={newBike.name}
                  onChange={(e) => setNewBike({...newBike, name: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="Model (e.g., CB Shine)"
                  value={newBike.model}
                  onChange={(e) => setNewBike({...newBike, model: e.target.value})}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAddBike(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
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

        {motorcycles.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-600 mb-2">No Motorcycles Added</h3>
            <p className="text-gray-500 mb-4">Start by adding your first motorcycle to begin tracking mileage</p>
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
  )
}
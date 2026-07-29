/**
 * Page Boutique
 * Règles NASA 1, 4, 5, 6, 7
 * CORRECTIONS :
 * - Vérification du stock total pour chaque événement
 * - Bouton "Voir" grisé si stock total = 0
 * - Affichage du statut "Complet" ou "Épuisé" sur la carte
 */

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ShoppingBag, Search, Filter, MapPin, Clock, Ticket, AlertCircle } from 'lucide-react'

const Boutique = () => {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [stockData, setStockData] = useState({})

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('evenements')
          .select(`
            *,
            organisateur:profiles(structure),
            types_tickets (id, nom, prix, stock)
          `)
          .eq('actif', true)
          .order('date', { ascending: true })

        if (error) throw error
        
        // Calculer le stock total pour chaque événement
        const stockMap = {}
        data.forEach(event => {
          const totalStock = event.types_tickets?.reduce((sum, t) => sum + (t.stock || 0), 0) || 0
          stockMap[event.id] = totalStock
        })
        setStockData(stockMap)
        
        setEvents(data || [])
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTotalStock = (eventId) => {
    return stockData[eventId] || 0
  }

  const isEventAvailable = (eventId) => {
    return getTotalStock(eventId) > 0
  }

  const filteredEvents = events.filter(event => {
    const matchSearch = event.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        event.lieu?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchFilter = !filter || event.lieu === filter
    return matchSearch && matchFilter
  })

  const uniqueLieux = [...new Set(events.map(e => e.lieu).filter(Boolean))]

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-white">
            <span className="text-yellow-400">Boutique</span> des événements
          </h1>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-300 focus:outline-none focus:border-yellow-400 text-sm"
            >
              <option value="">Tous les lieux</option>
              {uniqueLieux.map(lieu => (
                <option key={lieu} value={lieu}>{lieu}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-gray-900 rounded-xl p-4 animate-pulse">
                <div className="w-full h-48 bg-gray-800 rounded-lg"></div>
                <div className="h-6 bg-gray-800 rounded mt-4 w-3/4"></div>
                <div className="h-4 bg-gray-800 rounded mt-2 w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Aucun événement disponible</p>
            <p className="text-gray-500 text-sm">Revenez plus tard pour découvrir de nouveaux événements</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredEvents.map((event) => {
              const totalStock = getTotalStock(event.id)
              const isAvailable = totalStock > 0
              
              return (
                <div key={event.id} className="bg-gray-900 rounded-xl overflow-hidden hover:transform hover:scale-[1.02] transition-all duration-300 border border-gray-800">
                  <div className="relative">
                    <img
                      src={event.affiche_url || '/images/default-event.jpg'}
                      alt={event.nom}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                      onError={(e) => e.target.src = '/images/default-event.jpg'}
                    />
                    {event.types_tickets && event.types_tickets.length > 0 && (
                      <div className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">
                        {totalStock} places
                      </div>
                    )}
                    {!isAvailable && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          COMPLET
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-white font-semibold text-base md:text-lg truncate">{event.nom}</h3>
                    <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(event.date)}
                    </p>
                    <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {event.lieu}
                    </p>
                    {event.organisateur && (
                      <p className="text-gray-500 text-xs mt-1">{event.organisateur.structure}</p>
                    )}
                    <div className="flex flex-wrap gap-1 md:gap-2 mt-2 md:mt-3">
                      {event.types_tickets && event.types_tickets.slice(0, 3).map((type) => (
                        <span key={type.id} className="bg-gray-800 text-gray-300 text-[10px] md:text-xs px-2 py-1 rounded">
                          {type.nom}: {type.prix?.toLocaleString()} FCFA
                        </span>
                      ))}
                      {event.types_tickets && event.types_tickets.length > 3 && (
                        <span className="text-gray-500 text-xs">+{event.types_tickets.length - 3}</span>
                      )}
                    </div>
                    
                    {/* ===== BOUTON "VOIR" AVEC GESTION DU STOCK ===== */}
                    {isAvailable ? (
                      <Link
                        to={`/boutique/${event.id}`}
                        className="block mt-3 md:mt-4 bg-yellow-400 hover:bg-yellow-300 text-black text-center font-medium py-2 rounded-lg transition-colors text-sm md:text-base"
                      >
                        Voir
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="block mt-3 md:mt-4 bg-gray-700 text-gray-400 text-center font-medium py-2 rounded-lg cursor-not-allowed text-sm md:text-base w-full"
                      >
                        Complet
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Boutique
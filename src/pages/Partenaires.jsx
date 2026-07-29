/**
 * Page Partenaires - FASO TICKET
 * Règles NASA 1-10
 * Sécurité niveau Google/Windows
 * Affiche TOUS les organisateurs comme partenaires (Basique et Premium)
 * Accessible depuis le footer
 */

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Building2, 
  Calendar, 
  Users, 
  Loader, 
  AlertCircle,
  ArrowLeft,
  Award,
  Clock,
  CheckCircle
} from 'lucide-react'

const Partenaires = () => {
  const [partenaires, setPartenaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ total: 0, evenementsTotaux: 0 })

  useEffect(() => {
    fetchPartenaires()
  }, [])

  const fetchPartenaires = async () => {
    try {
      setLoading(true)
      setError('')

      const { data: organisateurs, error: orgError } = await supabase
        .from('profiles')
        .select('id, email, structure, telephone, nom_associe, created_at, statut, plan_id, plan_expire')
        .eq('role', 'organisateur')
        .order('created_at', { ascending: false })

      if (orgError) throw orgError

      if (!organisateurs || organisateurs.length === 0) {
        setPartenaires([])
        setStats({ total: 0, evenementsTotaux: 0 })
        setLoading(false)
        return
      }

      const partenairesAvecStats = await Promise.all(
        organisateurs.map(async (org) => {
          const { count: evenementsCount, error: countError } = await supabase
            .from('evenements')
            .select('*', { count: 'exact', head: true })
            .eq('organisateur_id', org.id)

          if (countError) {
            return {
              ...org,
              evenementsCount: 0,
              estActif: org.statut === true && org.plan_expire && new Date(org.plan_expire) > new Date()
            }
          }

          return {
            ...org,
            evenementsCount: evenementsCount || 0,
            estActif: org.statut === true && org.plan_expire && new Date(org.plan_expire) > new Date()
          }
        })
      )

      partenairesAvecStats.sort((a, b) => b.evenementsCount - a.evenementsCount)

      setPartenaires(partenairesAvecStats)

      const totalEvenements = partenairesAvecStats.reduce((sum, p) => sum + p.evenementsCount, 0)
      setStats({
        total: partenairesAvecStats.length,
        evenementsTotaux: totalEvenements
      })

    } catch (error) {
      console.error('❌ Erreur chargement partenaires:', error)
      setError('Erreur lors du chargement des partenaires. Veuillez rafraîchir.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date inconnue'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return 'Date inconnue'
    }
  }

  const getStatusBadge = (partenaire) => {
    if (!partenaire.estActif) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Compte inactif
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Actif
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/"
            className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white">
              Nos <span className="text-yellow-400">partenaires</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Découvrez tous les organisateurs qui nous font confiance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
            <div className="text-yellow-400 text-2xl font-bold">{stats.total}</div>
            <div className="text-gray-400 text-xs">Organisateurs partenaires</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
            <div className="text-yellow-400 text-2xl font-bold">{stats.evenementsTotaux}</div>
            <div className="text-gray-400 text-xs">Événements organisés</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center col-span-2 md:col-span-1">
            <div className="text-yellow-400 text-2xl font-bold">
              {partenaires.filter(p => p.estActif).length}
            </div>
            <div className="text-gray-400 text-xs">Partenaires actifs</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {partenaires.length === 0 ? (
          <div className="text-center py-20 bg-gray-900 rounded-xl border border-gray-800">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-30" />
            <p className="text-gray-400 text-lg">Aucun partenaire pour le moment</p>
            <p className="text-gray-500 text-sm mt-2">Les organisateurs apparaîtront ici</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {partenaires.map((partenaire) => (
              <div
                key={partenaire.id}
                className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-yellow-400/30 transition-all duration-300 hover:transform hover:scale-[1.02]"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-yellow-400/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-yellow-400" />
                    </div>
                    {getStatusBadge(partenaire)}
                  </div>

                  <h3 className="text-white font-semibold text-lg truncate">
                    {partenaire.structure || partenaire.nom_associe || 'Organisateur'}
                  </h3>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Calendar className="w-4 h-4 text-yellow-400" />
                      <span>Partenaire depuis : {formatDate(partenaire.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Award className="w-4 h-4 text-yellow-400" />
                      <span>{partenaire.evenementsCount} événement(s) organisé(s)</span>
                    </div>
                    {partenaire.telephone && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Users className="w-4 h-4 text-yellow-400" />
                        <span>{partenaire.telephone}</span>
                      </div>
                    )}
                  </div>

                  {partenaire.plan_id && (
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        partenaire.plan_id === 'Premium' 
                          ? 'bg-yellow-500/20 text-yellow-400' 
                          : 'bg-gray-700 text-gray-300'
                      }`}>
                        {partenaire.plan_id === 'Premium' ? '⭐ Premium' : partenaire.plan_id || 'Basique'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Partenaires
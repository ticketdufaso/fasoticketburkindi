/**
 * Gestion des Avis - Admin
 * Règles NASA 1-10
 * CORRECTIONS :
 * - Suppression des boutons "Approuver" et "Rejeter"
 * - Les avis sont visibles immédiatement (statut 'visible')
 * - Conservation de la suppression et de la réponse
 * - Mise à jour en temps réel des notifications
 * - ✅ AJOUT : Sélection multiple des avis
 * - ✅ AJOUT : Suppression en masse
 * - ✅ AJOUT : Bouton "Tout sélectionner" et "Désélectionner tout"
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  Star, Trash2, CheckCircle, XCircle, AlertCircle,
  Search, MessageSquare, Reply, Send, Loader, RefreshCw,
  CheckSquare, Square, Trash, X
} from 'lucide-react'

const AvisAdmin = () => {
  const [avis, setAvis] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('tous')
  const [selectedAvis, setSelectedAvis] = useState(null)
  const [reponse, setReponse] = useState('')
  const [showReplyModal, setShowReplyModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  
  // ✅ AJOUT : États pour la sélection multiple
  const [selectedIds, setSelectedIds] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false)
  const [deletingSelected, setDeletingSelected] = useState(false)

  useEffect(() => {
    fetchAvis()
    
    const subscription = supabase
      .channel('commentaires_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'commentaires' },
        () => {
          fetchAvis()
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const fetchAvis = async () => {
    try {
      setLoading(true)
      setError('')
      
      const { data, error, count } = await supabase
        .from('commentaires')
        .select(`
          *,
          reponses:reponses_avis(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === '42P01') {
          const { data: dataSimple, error: errorSimple, count: countSimple } = await supabase
            .from('commentaires')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
          
          if (errorSimple) throw errorSimple
          setAvis(dataSimple || [])
          setTotalCount(countSimple || 0)
        } else {
          throw error
        }
      } else {
        setAvis(data || [])
        setTotalCount(count || 0)
      }
      
      // Réinitialiser la sélection après chargement
      setSelectedIds([])
      setSelectAll(false)
      
    } catch (error) {
      console.error('Erreur chargement avis:', error)
      setError('Erreur lors du chargement des avis')
      setAvis([])
    } finally {
      setLoading(false)
    }
  }

  // ✅ AJOUT : Gestion de la sélection
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pid => pid !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([])
      setSelectAll(false)
    } else {
      const allIds = filteredAvis.map(a => a.id)
      setSelectedIds(allIds)
      setSelectAll(true)
    }
  }

  // ✅ AJOUT : Suppression en masse
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      setError('Aucun avis sélectionné')
      return
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedIds.length} avis sélectionnés ?`)) return
    if (!confirm('Cette action est irréversible. Confirmer ?')) return

    setDeletingSelected(true)
    setError('')
    setSuccess('')

    try {
      // Supprimer d'abord les réponses associées
      for (const id of selectedIds) {
        const { error: reponseError } = await supabase
          .from('reponses_avis')
          .delete()
          .eq('avis_id', id)

        if (reponseError && reponseError.code !== '42P01') {
          console.warn('Erreur suppression réponses:', reponseError)
        }
      }

      // Puis supprimer les commentaires
      const { error } = await supabase
        .from('commentaires')
        .delete()
        .in('id', selectedIds)

      if (error) throw error

      setSuccess(`✅ ${selectedIds.length} avis supprimés avec succès`)
      setSelectedIds([])
      setSelectAll(false)
      setShowDeleteSelectedModal(false)
      await fetchAvis()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la suppression en masse')
      setTimeout(() => setError(''), 3000)
    } finally {
      setDeletingSelected(false)
    }
  }

  // Suppression d'un seul avis
  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement cet avis ?')) return
    if (!confirm('Cette action est irréversible. Confirmer ?')) return

    try {
      const { error: reponseError } = await supabase
        .from('reponses_avis')
        .delete()
        .eq('avis_id', id)

      if (reponseError && reponseError.code !== '42P01') {
        console.warn('Erreur suppression réponses:', reponseError)
      }

      const { error } = await supabase
        .from('commentaires')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setSuccess('✅ Avis supprimé avec succès')
      setSelectedIds(prev => prev.filter(pid => pid !== id))
      await fetchAvis()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Erreur lors de la suppression')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleReply = async () => {
    if (!reponse.trim()) {
      setError('Veuillez écrire une réponse')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { error: checkError } = await supabase
        .from('reponses_avis')
        .select('id')
        .limit(1)

      if (checkError && checkError.code === '42P01') {
        setError('❌ La table reponses_avis n\'existe pas. Veuillez exécuter le script SQL.')
        setSubmitting(false)
        return
      }

      const { error: insertError } = await supabase
        .from('reponses_avis')
        .insert([{
          avis_id: selectedAvis.id,
          reponse: reponse.trim()
        }])

      if (insertError) throw insertError

      setSuccess('✅ Réponse ajoutée avec succès')
      setShowReplyModal(false)
      setReponse('')
      await fetchAvis()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erreur:', error)
      setError('Erreur lors de l\'envoi de la réponse: ' + (error.message || 'Veuillez réessayer'))
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (note) => {
    return [...Array(5)].map((_, i) => (
      <span key={i} className={i < note ? 'text-yellow-400' : 'text-gray-600'}>★</span>
    ))
  }

  const getStatusBadge = (statut) => {
    if (!statut || statut === 'visible' || statut === 'approuve' || statut === 'approuvé' || statut === 'approved' || statut === 'validé' || statut === 'valide') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">✅ Visible</span>
    }
    if (statut === 'supprime' || statut === 'rejete' || statut === 'rejeté') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">❌ Supprimé</span>
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">⏳ {statut}</span>
  }

  const filteredAvis = avis.filter(a => {
    const matchSearch = a.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.commentaire?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchFilter = filter === 'tous' || 
                        (filter === 'visible' && (!a.statut || a.statut === 'visible' || a.statut === 'approuve' || a.statut === 'approuvé')) ||
                        (filter === 'supprime' && (a.statut === 'supprime' || a.statut === 'rejete' || a.statut === 'rejeté'))
    return matchSearch && matchFilter
  })

  const displayedAvis = filteredAvis.slice(0, visibleCount)

  const loadMore = () => {
    setVisibleCount(prev => prev + 10)
  }

  // ✅ AJOUT : Mettre à jour selectAll quand la sélection change
  useEffect(() => {
    if (filteredAvis.length > 0 && selectedIds.length === filteredAvis.length) {
      setSelectAll(true)
    } else {
      setSelectAll(false)
    }
  }, [selectedIds, filteredAvis])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 md:p-6 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Gestion des avis</h2>
            <span className="text-gray-400 text-sm">({totalCount})</span>
            {selectedIds.length > 0 && (
              <span className="text-blue-400 text-xs bg-blue-500/20 px-2 py-0.5 rounded-full">
                {selectedIds.length} sélectionné(s)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* ✅ AJOUT : Boutons de sélection */}
            {filteredAvis.length > 0 && (
              <>
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
                >
                  {selectAll ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                  {selectAll ? 'Désélectionner tout' : 'Tout sélectionner'}
                </button>
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => setShowDeleteSelectedModal(true)}
                    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
                  >
                    <Trash className="w-4 h-4" />
                    Supprimer la sélection ({selectedIds.length})
                  </button>
                )}
              </>
            )}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm"
            >
              <option value="tous">Tous</option>
              <option value="visible">✅ Visibles</option>
              <option value="supprime">❌ Supprimés</option>
            </select>
            <button
              onClick={fetchAvis}
              className="text-gray-400 hover:text-yellow-400 transition-colors p-2"
              title="Rafraîchir"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg whitespace-pre-wrap">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-2 rounded-lg">
            {success}
          </div>
        )}
      </div>

      {displayedAvis.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Aucun avis trouvé</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-800">
            {displayedAvis.map((a) => (
              <div key={a.id} className="p-4 md:p-6 hover:bg-gray-800/30 transition-colors">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {/* ✅ AJOUT : Case à cocher de sélection */}
                    <button
                      onClick={() => toggleSelect(a.id)}
                      className="mt-1 text-gray-400 hover:text-yellow-400 transition-colors flex-shrink-0"
                    >
                      {selectedIds.includes(a.id) ? (
                        <CheckSquare className="w-5 h-5 text-yellow-400" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-white font-medium">{a.nom}</span>
                        <div className="flex text-sm">{renderStars(a.note)}</div>
                        {getStatusBadge(a.statut)}
                      </div>
                      {a.commentaire && (
                        <p className="text-gray-300 text-sm mt-1">{a.commentaire}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-gray-500 text-xs">
                          {new Date(a.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {a.reponses && a.reponses.length > 0 && (
                          <span className="text-yellow-400 text-xs flex items-center gap-1">
                            <Reply className="w-3 h-3" />
                            {a.reponses.length} réponse(s)
                          </span>
                        )}
                      </div>
                      {a.reponses && a.reponses.map((r) => (
                        <div key={r.id} className="mt-2 bg-gray-800 rounded-lg p-3 border border-gray-700">
                          <p className="text-gray-300 text-sm">
                            <span className="text-yellow-400 font-medium">Admin :</span> {r.reponse}
                          </p>
                          <span className="text-gray-500 text-xs">
                            {new Date(r.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-8 sm:ml-0">
                    <button
                      onClick={() => {
                        setSelectedAvis(a)
                        setShowReplyModal(true)
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                      title="Répondre"
                    >
                      <Reply className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                      title="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAvis.length > visibleCount && (
            <div className="p-4 text-center border-t border-gray-800">
              <button
                onClick={loadMore}
                className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm font-medium"
              >
                Voir plus ({filteredAvis.length - visibleCount} restants)
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Réponse */}
      {showReplyModal && selectedAvis && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-lg w-full border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Répondre à l'avis</h3>
              <button
                onClick={() => setShowReplyModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{selectedAvis.nom}</span>
                <div className="flex text-sm">{renderStars(selectedAvis.note)}</div>
              </div>
              {selectedAvis.commentaire && (
                <p className="text-gray-300 text-sm mt-1">{selectedAvis.commentaire}</p>
              )}
            </div>

            <textarea
              value={reponse}
              onChange={(e) => setReponse(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-400 resize-none"
              rows="4"
              placeholder="Écrivez votre réponse..."
            />

            {error && (
              <div className="mt-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg whitespace-pre-wrap">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowReplyModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleReply}
                disabled={submitting}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ AJOUT : Modal de confirmation suppression en masse */}
      {showDeleteSelectedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <Trash className="w-8 h-8 text-red-400" />
              <h3 className="text-white font-semibold text-lg">Confirmer la suppression</h3>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Vous êtes sur le point de supprimer <span className="text-red-400 font-bold">{selectedIds.length}</span> avis.
            </p>
            <p className="text-gray-400 text-sm mb-4">Cette action est irréversible.</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteSelectedModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deletingSelected}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingSelected ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash className="w-4 h-4" />
                    Supprimer {selectedIds.length} avis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AvisAdmin
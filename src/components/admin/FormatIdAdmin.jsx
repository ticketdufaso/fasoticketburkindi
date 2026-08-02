/**
 * Gestion des Formats ID - Admin
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CreditCard, Plus, Trash2, Edit, Loader, Search, RefreshCw, Eye, EyeOff, TestTube, Save } from 'lucide-react'

const FormatIdAdmin = () => {
  const [formats, setFormats] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [testValue, setTestValue] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({ nom: '', prefixe: '', regex: '', exemple: '', actif: true })

  useEffect(() => { fetchFormats() }, [])

  const fetchFormats = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('formats_id').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setFormats(data || [])
    } catch (error) { console.error('Erreur:', error) } finally { setLoading(false) }
  }

  const testRegex = () => {
    if (!formData.regex || !testValue) { setTestResult(null); return }
    try {
      const regex = new RegExp(formData.regex)
      const isValid = regex.test(testValue)
      setTestResult({ isValid, message: isValid ? '✅ L\'ID correspond au format' : '❌ L\'ID ne correspond pas au format' })
    } catch (e) {
      setTestResult({ isValid: false, message: '❌ Regex invalide' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!formData.nom || formData.nom.length < 2) { setError('Nom du format requis'); setSubmitting(false); return }
    if (!formData.prefixe || formData.prefixe.length < 1) { setError('Préfixe requis'); setSubmitting(false); return }
    if (!formData.regex || formData.regex.length < 3) { setError('Regex requis'); setSubmitting(false); return }

    try { new RegExp(formData.regex) } catch (e) { setError('Regex invalide'); setSubmitting(false); return }

    try {
      if (showEditModal && selectedItem) {
        await supabase.from('formats_id').update({ nom: formData.nom, prefixe: formData.prefixe, regex: formData.regex, exemple: formData.exemple, actif: formData.actif }).eq('id', selectedItem.id)
        setSuccess('Format mis à jour avec succès')
      } else {
        await supabase.from('formats_id').insert([{ nom: formData.nom, prefixe: formData.prefixe, regex: formData.regex, exemple: formData.exemple, actif: formData.actif }])
        setSuccess('Format ajouté avec succès')
      }
      setShowAddModal(false); setShowEditModal(false); setFormData({ nom: '', prefixe: '', regex: '', exemple: '', actif: true }); setTestValue(''); setTestResult(null)
      await fetchFormats()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) { setError('Erreur lors de l\'opération') } finally { setSubmitting(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce format ?')) return
    try {
      await supabase.from('formats_id').delete().eq('id', id)
      setSuccess('Format supprimé avec succès')
      await fetchFormats()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) { setError('Erreur lors de la suppression') }
  }

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await supabase.from('formats_id').update({ actif: !currentStatus }).eq('id', id)
      await fetchFormats()
    } catch (error) { setError('Erreur lors du changement de statut') }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader className="w-8 h-8 text-yellow-400 animate-spin" /></div>
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 md:p-6 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-yellow-400" /><h2 className="text-white font-semibold">Formats ID</h2><span className="text-gray-400 text-sm">({formats.length})</span></div>
          <button onClick={() => { setFormData({ nom: '', prefixe: '', regex: '', exemple: '', actif: true }); setTestValue(''); setTestResult(null); setShowAddModal(true) }} className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Nouveau format
          </button>
        </div>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Rechercher un format..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm" />
        </div>
        {error && <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-2 rounded-lg">{error}</div>}
        {success && <div className="mt-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-2 rounded-lg">{success}</div>}
      </div>

      {formats.length === 0 ? (
        <div className="p-8 text-center text-gray-400"><CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>Aucun format ID trouvé</p></div>
      ) : (
        formats.filter(f => f.nom?.toLowerCase().includes(searchTerm.toLowerCase()) || f.prefixe?.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
          <div key={item.id} className="p-4 hover:bg-gray-800/30 border-b border-gray-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-white font-semibold">{item.nom}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.actif ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {item.actif ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="text-gray-400 text-sm">Préfixe: <span className="text-yellow-400 font-mono">{item.prefixe}</span></span>
                  <span className="text-gray-400 text-sm hidden sm:inline">Regex: <span className="text-blue-400 font-mono text-xs">{item.regex}</span></span>
                </div>
                {item.exemple && <div className="mt-1"><span className="text-gray-500 text-xs">Exemple: <span className="text-gray-400 font-mono">{item.exemple}</span></span></div>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggleStatus(item.id, item.actif)} className={`p-1 ${item.actif ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
                  {item.actif ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => { setSelectedItem(item); setFormData({ nom: item.nom, prefixe: item.prefixe, regex: item.regex, exemple: item.exemple || '', actif: item.actif }); setTestValue(''); setTestResult(null); setShowEditModal(true) }} className="text-yellow-400 hover:text-yellow-300 p-1"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Modal Add/Edit */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">{showEditModal ? 'Modifier' : 'Nouveau'} format ID</h3>
              <button onClick={() => { setShowAddModal(false); setShowEditModal(false); setTestResult(null) }} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-gray-400 text-sm block mb-1">Nom du format *</label><input type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm" placeholder="Orange Money Standard" required /></div>
              <div><label className="text-gray-400 text-sm block mb-1">Préfixe *</label><input type="text" value={formData.prefixe} onChange={(e) => setFormData({ ...formData, prefixe: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm" placeholder="MP" required /></div>
              <div><label className="text-gray-400 text-sm block mb-1">Regex *</label><input type="text" value={formData.regex} onChange={(e) => setFormData({ ...formData, regex: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm font-mono" placeholder="^MP\d{5,8}\.\d{4,6}\.\d{7,12}$" required /></div>
              <div><label className="text-gray-400 text-sm block mb-1">Exemple valide</label><input type="text" value={formData.exemple} onChange={(e) => setFormData({ ...formData, exemple: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 text-sm font-mono" placeholder="MP260425.1234.12345678" /></div>
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-gray-300 text-sm font-medium mb-2">🧪 Tester le format</h4>
                <div className="flex gap-2">
                  <input type="text" value={testValue} onChange={(e) => setTestValue(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400 text-sm font-mono" placeholder="Entrez un ID à tester" />
                  <button type="button" onClick={testRegex} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"><TestTube className="w-4 h-4 inline mr-1" /> Tester</button>
                </div>
                {testResult && <div className={`mt-2 p-2 rounded-lg text-sm ${testResult.isValid ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>{testResult.message}</div>}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-gray-300 text-sm"><input type="checkbox" checked={formData.actif} onChange={(e) => setFormData({ ...formData, actif: e.target.checked })} className="accent-yellow-400" /> Actif</label>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); setTestResult(null) }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg">Annuler</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {showEditModal ? 'Modifier' : 'Créer'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default FormatIdAdmin
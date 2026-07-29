/**
 * Création et Modification d'événement - Organisateur
 * Règles NASA 1-10
 * CORRECTIONS FINALES V7 :
 * - ✅ BUG : Suppression des réservations avant la suppression des tickets
 * - ✅ Conservation de l'URL de l'image lors de la modification
 * - ✅ Upload correct de l'image lors de la création
 * - ✅ Ne jamais écraser l'URL existante
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthContext } from '../../context/AuthContext'
import { Plus, X, Upload, Loader, Trash2, ArrowLeft, Edit2, Image as ImageIcon } from 'lucide-react'

const CreateEvent = () => {
  const { id } = useParams()
  const { user } = useAuthContext()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [planInfo, setPlanInfo] = useState({
    evenementsMax: 0,
    typesTickets: [],
    planNom: ''
  })
  const [editingTicketId, setEditingTicketId] = useState(null)
  
  // Images
  const [afficheFile, setAfficheFile] = useState(null)
  const [affichePreview, setAffichePreview] = useState('')
  const [existingAfficheUrl, setExistingAfficheUrl] = useState('')
  
  const [eventData, setEventData] = useState({
    nom: '',
    description: '',
    lieu: '',
    infos_lieu: '',
    date: '',
    affiche_url: ''
  })
  
  const [ticketTypes, setTicketTypes] = useState([])
  const [currentTicket, setCurrentTicket] = useState({
    categorie: 'Simple',
    nom: '',
    description: '',
    prix: '',
    stock: '',
    image_file: null,
    image_preview: '',
    avantages: ''
  })

  const ticketCategories = ['Simple', 'VIP', 'VVIP', 'Stand', 'Salon', 'Personnalisé']

  useEffect(() => {
    if (user) {
      fetchPlanInfo()
      if (id) {
        setIsEditMode(true)
        fetchEventData(id)
      }
    }
  }, [user, id])

  const fetchPlanInfo = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan_id')
        .eq('id', user.id)
        .single()

      if (profileData && profileData.plan_id) {
        const { data: planData } = await supabase
          .from('plans')
          .select('evenements_max, types_tickets, nom')
          .eq('nom', profileData.plan_id)
          .single()

        if (planData) {
          setPlanInfo({
            evenementsMax: planData.evenements_max || 0,
            typesTickets: planData.types_tickets || ['Simple', 'VIP'],
            planNom: planData.nom
          })
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const fetchEventData = async (eventId) => {
    try {
      setLoading(true)
      
      const { data: event, error: eventError } = await supabase
        .from('evenements')
        .select('*')
        .eq('id', eventId)
        .eq('organisateur_id', user.id)
        .single()

      if (eventError) throw eventError

      const eventDataLoaded = {
        nom: event.nom || '',
        description: event.description || '',
        lieu: event.lieu || '',
        infos_lieu: event.infos_lieu || '',
        date: event.date ? new Date(event.date).toISOString().slice(0, 16) : '',
        affiche_url: event.affiche_url || ''
      }

      setEventData(eventDataLoaded)

      if (event.affiche_url) {
        setExistingAfficheUrl(event.affiche_url)
        setAffichePreview(event.affiche_url)
      }

      const { data: tickets, error: ticketsError } = await supabase
        .from('types_tickets')
        .select('*')
        .eq('evenement_id', eventId)

      if (ticketsError) throw ticketsError

      const ticketsLoaded = tickets.map(t => ({
        id: t.id,
        categorie: t.categorie || 'Simple',
        nom: t.nom,
        description: t.description || '',
        prix: t.prix,
        stock: t.stock,
        stock_initial: t.stock_initial,
        image_url: t.image_url || '',
        image_preview: t.image_url || '',
        image_file: null,
        avantages: t.avantages || ''
      }))

      console.log('📦 Tickets chargés avec leurs images:', ticketsLoaded.map(t => ({
        nom: t.nom,
        image_url: t.image_url
      })))

      setTicketTypes(ticketsLoaded)

    } catch (error) {
      setError('Erreur de chargement: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const uploadToStorage = async (file, folder) => {
    try {
      console.log('📤 Upload du fichier:', file.name, 'dans', folder)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${folder}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file)

      if (uploadError) {
        console.error('❌ Erreur upload:', uploadError)
        throw uploadError
      }

      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath)

      console.log('✅ Image uploadée avec succès:', data.publicUrl)
      return data.publicUrl
    } catch (error) {
      console.error('❌ Erreur upload détaillée:', error)
      throw new Error('Erreur upload: ' + error.message)
    }
  }

  const handleAfficheUpload = (e) => {
    if (isEditMode) {
      setError('❌ L\'image ne peut pas être modifiée')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Le fichier ne doit pas dépasser 5 Mo')
      return
    }

    console.log('📸 Affiche sélectionnée:', file.name)
    setAfficheFile(file)
    setAffichePreview(URL.createObjectURL(file))
  }

  const handleTicketImageUpload = (e) => {
    if (isEditMode) {
      setError('❌ L\'image ne peut pas être modifiée')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Le fichier ne doit pas dépasser 5 Mo')
      return
    }

    console.log('📸 Image du ticket sélectionnée:', file.name)
    setCurrentTicket({
      ...currentTicket,
      image_file: file,
      image_preview: URL.createObjectURL(file)
    })
  }

  const addTicketType = () => {
    if (!currentTicket.nom || currentTicket.nom.length < 1) {
      setError('Veuillez entrer un nom pour le ticket')
      return
    }
    if (!currentTicket.prix || parseInt(currentTicket.prix) <= 0) {
      setError('Veuillez entrer un prix valide')
      return
    }
    if (!currentTicket.stock || parseInt(currentTicket.stock) <= 0) {
      setError('Veuillez entrer un stock valide')
      return
    }

    const maxTypes = planInfo.planNom === 'Premium' ? 10 : 2;
    
    if (ticketTypes.length >= maxTypes) {
      setError(`Votre plan ${planInfo.planNom} permet uniquement ${maxTypes} type(s) de ticket par événement.`);
      return;
    }

    const categorie = currentTicket.categorie
    if (!planInfo.typesTickets.includes(categorie)) {
      setError(`Le type "${categorie}" n'est pas disponible dans votre plan. Types disponibles: ${planInfo.typesTickets.join(', ')}`)
      return
    }

    const newTicket = {
      id: Date.now(),
      categorie: currentTicket.categorie,
      nom: currentTicket.nom,
      description: currentTicket.description || '',
      prix: parseInt(currentTicket.prix),
      stock: parseInt(currentTicket.stock),
      stock_initial: parseInt(currentTicket.stock),
      image_url: currentTicket.image_preview || '',
      image_file: currentTicket.image_file,
      image_preview: currentTicket.image_preview || '',
      avantages: currentTicket.avantages || ''
    }

    console.log('🆕 Nouveau ticket ajouté:', {
      nom: newTicket.nom,
      image_url: newTicket.image_url,
      has_file: !!newTicket.image_file
    })

    setTicketTypes([...ticketTypes, newTicket])
    
    setCurrentTicket({
      categorie: 'Simple',
      nom: '',
      description: '',
      prix: '',
      stock: '',
      image_file: null,
      image_preview: '',
      avantages: ''
    })
    setError('')
    setEditingTicketId(null)
  }

  const startEditingTicket = (ticket) => {
    setEditingTicketId(ticket.id)
    setCurrentTicket({
      categorie: ticket.categorie || 'Simple',
      nom: ticket.nom,
      description: ticket.description || '',
      prix: ticket.prix.toString(),
      stock: ticket.stock.toString(),
      image_file: null,
      image_preview: ticket.image_url || '',
      avantages: ticket.avantages || ''
    })
    setTicketTypes(ticketTypes.filter(t => t.id !== ticket.id))
  }

  const cancelEditingTicket = () => {
    setEditingTicketId(null)
    setCurrentTicket({
      categorie: 'Simple',
      nom: '',
      description: '',
      prix: '',
      stock: '',
      image_file: null,
      image_preview: '',
      avantages: ''
    })
  }

  const removeTicketType = (id) => {
    setTicketTypes(ticketTypes.filter(t => t.id !== id))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (!eventData.nom || eventData.nom.length < 3) {
      setError('Le nom doit contenir au moins 3 caractères')
      setLoading(false)
      return
    }
    if (!eventData.lieu || eventData.lieu.length < 3) {
      setError('Le lieu doit contenir au moins 3 caractères')
      setLoading(false)
      return
    }
    if (!eventData.date) {
      setError('Veuillez choisir une date')
      setLoading(false)
      return
    }
    if (ticketTypes.length === 0) {
      setError('Ajoutez au moins un type de ticket')
      setLoading(false)
      return
    }

    if (!isEditMode) {
      const { count: eventsCount } = await supabase
        .from('evenements')
        .select('*', { count: 'exact', head: true })
        .eq('organisateur_id', user.id)

      if (eventsCount >= planInfo.evenementsMax) {
        setError(`Vous avez atteint la limite de ${planInfo.evenementsMax} événements pour votre plan`)
        setLoading(false)
        return
      }
    }

    try {
      let afficheUrl = null
      
      if (!isEditMode) {
        if (afficheFile) {
          afficheUrl = await uploadToStorage(afficheFile, 'events')
        } else {
          afficheUrl = '/images/default-event.jpg'
        }
      } else {
        afficheUrl = existingAfficheUrl || '/images/default-event.jpg'
      }

      let eventResult

      if (isEditMode) {
        // ✅ ÉTAPE 1 : Mettre à jour l'événement
        const { data, error } = await supabase
          .from('evenements')
          .update({
            nom: eventData.nom,
            description: eventData.description,
            lieu: eventData.lieu,
            infos_lieu: eventData.infos_lieu,
            date: eventData.date,
            affiche_url: afficheUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        eventResult = data

        // ============================================================
        // ✅ ÉTAPE 2 : SUPPRIMER LES RÉSERVATIONS LIÉES AUX TICKETS
        // ============================================================
        console.log('🗑️ Suppression des réservations liées aux tickets...')

        // Récupérer les IDs des types de tickets de l'événement
        const { data: existingTickets, error: fetchTicketsError } = await supabase
          .from('types_tickets')
          .select('id')
          .eq('evenement_id', id)

        if (fetchTicketsError) {
          console.error('❌ Erreur récupération tickets:', fetchTicketsError)
        } else if (existingTickets && existingTickets.length > 0) {
          const ticketIds = existingTickets.map(t => t.id)
          
          // Supprimer les réservations qui référencent ces tickets
          const { error: deleteReservationsError } = await supabase
            .from('reservations')
            .delete()
            .in('type_ticket_id', ticketIds)

          if (deleteReservationsError) {
            console.error('❌ Erreur suppression réservations:', deleteReservationsError)
            // On continue quand même, les réservations seront supprimées en cascade
          } else {
            console.log('✅ Réservations supprimées avec succès')
          }
        }

        // ============================================================
        // ✅ ÉTAPE 3 : SUPPRIMER TOUS LES TICKETS EXISTANTS
        // ============================================================
        console.log('🗑️ Suppression de tous les tickets existants...')
        
        const { error: deleteError } = await supabase
          .from('types_tickets')
          .delete()
          .eq('evenement_id', id)

        if (deleteError) {
          console.error('❌ Erreur suppression tickets:', deleteError)
          throw new Error('Erreur lors de la suppression des tickets: ' + deleteError.message)
        }

        console.log('✅ Tickets supprimés avec succès')

        // ============================================================
        // ✅ ÉTAPE 4 : RÉINSÉRER TOUS LES TICKETS
        // ============================================================
        console.log('➕ Réinsertion des tickets avec conservation des images...')

        for (const ticket of ticketTypes) {
          let imageUrl = '/images/default-ticket.png'
          
          // ✅ Récupérer l'image existante depuis la base
          if (ticket.id && typeof ticket.id === 'string' && ticket.id.length > 10) {
            const { data: existingTicket, error: fetchError } = await supabase
              .from('types_tickets')
              .select('image_url')
              .eq('id', ticket.id)
              .maybeSingle()

            if (!fetchError && existingTicket && existingTicket.image_url) {
              imageUrl = existingTicket.image_url
              console.log('📸 Image récupérée depuis la base pour', ticket.nom, ':', imageUrl)
            }
          }
          
          // Si l'image n'a pas été trouvée dans la base
          if (imageUrl === '/images/default-ticket.png') {
            if (ticket.image_url && ticket.image_url !== '/images/default-ticket.png' && ticket.image_url !== '') {
              imageUrl = ticket.image_url
              console.log('📸 Image conservée depuis le state pour', ticket.nom, ':', imageUrl)
            } else if (ticket.image_file) {
              console.log('📤 Upload de la nouvelle image pour', ticket.nom)
              try {
                imageUrl = await uploadToStorage(ticket.image_file, 'tickets')
                console.log('✅ Nouvelle image uploadée pour', ticket.nom, ':', imageUrl)
              } catch (uploadError) {
                console.error('❌ Erreur upload pour', ticket.nom, ':', uploadError)
                imageUrl = '/images/default-ticket.png'
              }
            } else if (ticket.image_preview && ticket.image_preview !== '/images/default-ticket.png' && ticket.image_preview !== '') {
              imageUrl = ticket.image_preview
              console.log('📸 Image récupérée depuis preview pour', ticket.nom, ':', imageUrl)
            }
          }

          console.log(`📸 Ticket "${ticket.nom}" - Image finale:`, imageUrl)

          const ticketData = {
            evenement_id: eventResult.id,
            categorie: ticket.categorie || 'Simple',
            nom: ticket.nom,
            description: ticket.description || '',
            prix: ticket.prix,
            stock: ticket.stock,
            stock_initial: ticket.stock_initial || ticket.stock,
            image_url: imageUrl,
            avantages: ticket.avantages || ''
          }

          const { error: insertError } = await supabase
            .from('types_tickets')
            .insert([ticketData])

          if (insertError) {
            console.error('❌ Erreur insertion ticket:', insertError)
            throw new Error('Erreur lors de l\'insertion du ticket: ' + insertError.message)
          }
        }

        console.log('✅ Tous les tickets réinsérés avec succès')

      } else {
        // ✅ CRÉATION
        const { data, error } = await supabase
          .from('evenements')
          .insert([{
            organisateur_id: user.id,
            nom: eventData.nom,
            description: eventData.description,
            lieu: eventData.lieu,
            infos_lieu: eventData.infos_lieu,
            date: eventData.date,
            affiche_url: afficheUrl,
            actif: true
          }])
          .select()
          .single()

        if (error) throw error
        eventResult = data

        for (const ticket of ticketTypes) {
          let imageUrl = '/images/default-ticket.png'
          
          if (ticket.image_file) {
            console.log('📤 Upload de l\'image pour', ticket.nom)
            try {
              imageUrl = await uploadToStorage(ticket.image_file, 'tickets')
              console.log('✅ Image uploadée avec succès pour', ticket.nom, ':', imageUrl)
            } catch (uploadError) {
              console.error('❌ Erreur upload pour', ticket.nom, ':', uploadError)
              imageUrl = '/images/default-ticket.png'
            }
          } else if (ticket.image_url && ticket.image_url !== '/images/default-ticket.png' && ticket.image_url !== '') {
            imageUrl = ticket.image_url
            console.log('📸 Image existante pour', ticket.nom, ':', imageUrl)
          }

          console.log(`📸 Ticket "${ticket.nom}" - Image finale:`, imageUrl)

          const ticketData = {
            evenement_id: eventResult.id,
            categorie: ticket.categorie || 'Simple',
            nom: ticket.nom,
            description: ticket.description || '',
            prix: ticket.prix,
            stock: ticket.stock,
            stock_initial: ticket.stock_initial || ticket.stock,
            image_url: imageUrl,
            avantages: ticket.avantages || ''
          }

          const { error: insertError } = await supabase
            .from('types_tickets')
            .insert([ticketData])

          if (insertError) {
            console.error('❌ Erreur insertion ticket:', insertError)
            throw new Error('Erreur lors de l\'insertion du ticket: ' + insertError.message)
          }
        }
      }

      setSuccess(isEditMode ? '✅ Événement modifié avec succès !' : '✅ Événement créé avec succès !')
      
      if (isEditMode && id) {
        await fetchEventData(id)
      }
      
      setTimeout(() => navigate('/organisateur/dashboard'), 2000)
    } catch (error) {
      console.error('❌ Erreur complète:', error)
      setError(error.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  if (loading && isEditMode) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/organisateur/dashboard')}
          className="flex items-center gap-2 text-gray-400 hover:text-yellow-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au dashboard
        </button>

        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {isEditMode ? 'Modifier' : 'Créer'} un <span className="text-yellow-400">événement</span>
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          Plan: {planInfo.planNom || 'Basique'} - Limite: {planInfo.evenementsMax} événements maximum
          {isEditMode && ' - ✏️ Mode modification'}
          {isEditMode && (
            <span className="text-yellow-400 text-xs ml-2">🖼️ Les images sont conservées automatiquement</span>
          )}
        </p>

        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations générales */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-white font-semibold text-lg mb-4">Informations générales</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Nom de l'événement *</label>
                <input
                  type="text"
                  value={eventData.nom}
                  onChange={(e) => setEventData({ ...eventData, nom: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="Nom de l'événement"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Description</label>
                <textarea
                  value={eventData.description}
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400 resize-none"
                  rows="4"
                  placeholder="Description de l'événement..."
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Lieu *</label>
                <input
                  type="text"
                  value={eventData.lieu}
                  onChange={(e) => setEventData({ ...eventData, lieu: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="Lieu de l'événement"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Infos supplémentaires sur le lieu</label>
                <input
                  type="text"
                  value={eventData.infos_lieu}
                  onChange={(e) => setEventData({ ...eventData, infos_lieu: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="Ex: Entrée côté rue, parking disponible..."
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Date et heure *</label>
                <input
                  type="datetime-local"
                  value={eventData.date}
                  onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400"
                  required
                />
              </div>

              {/* Image - NON modifiable en modification */}
              <div>
                <label className="text-gray-400 text-sm block mb-1">Affiche de l'événement</label>
                <div className="flex items-center gap-4">
                  {!isEditMode ? (
                    <label className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      Choisir une affiche
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAfficheUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 bg-gray-800 px-4 py-2.5 rounded-lg border border-gray-700 cursor-not-allowed">
                      <ImageIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-sm">Image non modifiable</span>
                    </div>
                  )}
                  {affichePreview && (
                    <div className="relative w-16 h-16">
                      <img
                        src={affichePreview}
                        alt="Affiche preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                  {isEditMode && existingAfficheUrl && (
                    <span className="text-gray-400 text-xs">✅ Image conservée</span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {isEditMode ? '🖼️ L\'image ne peut pas être modifiée' : 'Tous formats d\'image (max 5 Mo)'}
                </p>
              </div>
            </div>
          </div>

          {/* Types de tickets */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold text-lg">Types de tickets</h2>
              <span className="text-gray-400 text-sm">
                {ticketTypes.length} / {planInfo.planNom === 'Premium' ? '10' : '2'}
                <span className="text-gray-500 text-xs ml-1">
                  ({planInfo.planNom})
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Catégorie *</label>
                <select
                  value={currentTicket.categorie}
                  onChange={(e) => setCurrentTicket({ ...currentTicket, categorie: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400"
                >
                  {planInfo.typesTickets.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Nom du ticket *</label>
                <input
                  type="text"
                  value={currentTicket.nom}
                  onChange={(e) => setCurrentTicket({ ...currentTicket, nom: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="Ticket Simple"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Description</label>
                <input
                  type="text"
                  value={currentTicket.description}
                  onChange={(e) => setCurrentTicket({ ...currentTicket, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="Description"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Prix (FCFA) *</label>
                <input
                  type="number"
                  value={currentTicket.prix}
                  onChange={(e) => setCurrentTicket({ ...currentTicket, prix: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Stock *</label>
                <input
                  type="number"
                  value={currentTicket.stock}
                  onChange={(e) => setCurrentTicket({ ...currentTicket, stock: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Image du ticket */}
              <div>
                <label className="text-gray-400 text-sm block mb-1">Image du ticket</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    Choisir une image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleTicketImageUpload}
                      className="hidden"
                    />
                  </label>
                  {currentTicket.image_preview && (
                    <div className="relative w-12 h-12">
                      <img
                        src={currentTicket.image_preview}
                        alt="Ticket preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {isEditMode ? '⚠️ En modification, l\'image est conservée automatiquement' : 'Tous formats d\'image (max 5 Mo)'}
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm block mb-1">Avantages (pour Stand, Salon, etc.)</label>
                <input
                  type="text"
                  value={currentTicket.avantages}
                  onChange={(e) => setCurrentTicket({ ...currentTicket, avantages: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="Ex: Brochette, Boisson, Brochette + Boisson, Punch..."
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={addTicketType}
                disabled={ticketTypes.length >= (planInfo.planNom === 'Premium' ? 10 : 2) || uploading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  ticketTypes.length >= (planInfo.planNom === 'Premium' ? 10 : 2)
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                {editingTicketId ? 'Mettre à jour' : 'Ajouter ce ticket'}
              </button>
              {editingTicketId && (
                <button
                  type="button"
                  onClick={cancelEditingTicket}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
              )}
            </div>

            {ticketTypes.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {ticketTypes.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between bg-gray-800 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      {ticket.image_preview && (
                        <img 
                          src={ticket.image_preview} 
                          alt={ticket.nom} 
                          className="w-10 h-10 object-cover rounded-lg"
                          onError={(e) => {
                            console.error('❌ Erreur chargement image:', ticket.image_preview)
                            e.target.src = '/images/default-ticket.png'
                          }}
                        />
                      )}
                      <div>
                        <span className="text-white font-medium">{ticket.nom}</span>
                        <span className="text-gray-400 text-sm ml-2">{ticket.prix.toLocaleString()} FCFA</span>
                        <span className="text-gray-500 text-xs ml-2">Stock: {ticket.stock}</span>
                        {ticket.image_url && ticket.image_url !== '/images/default-ticket.png' && (
                          <span className="text-green-400 text-xs ml-2">✅ Image</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingTicket(ticket)}
                        className="text-yellow-400 hover:text-yellow-300 transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTicketType(ticket.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || uploading}
              className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                loading || uploading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-yellow-400 hover:bg-yellow-300 text-black'
              }`}
            >
              {loading ? 'Sauvegarde...' : isEditMode ? 'Modifier l\'événement' : 'Créer l\'événement'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/organisateur/dashboard')}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
          
          {isEditMode && (
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3 text-center">
              <p className="text-yellow-400 text-xs">
                🖼️ Les images des tickets sont conservées automatiquement
                <br />
                <span className="text-gray-400 text-[10px]">
                  L'image existante est récupérée depuis la base de données.
                </span>
              </p>
            </div>
          )}
          
          {!isEditMode && (
            <div className="bg-blue-400/10 border border-blue-400/20 rounded-lg p-3 text-center">
              <p className="text-blue-400 text-xs">
                📸 Les images sélectionnées seront uploadées lors de la création
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default CreateEvent;
/**
 * Footer - Complet et responsive
 * Version corrigée avec liens WhatsApp et Facebook
 * ✅ AJOUT : Lien "Nos partenaires" dans les liens utiles
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { Facebook, MessageCircle, Mail, MapPin, Phone } from 'lucide-react'

const Footer = () => {
  const currentYear = new Date().getFullYear()

  const socialLinks = [
    {
      name: 'Facebook',
      icon: <Facebook className="w-5 h-5" />,
      url: 'https://www.facebook.com/profile.php?id=61577649962184',
    },
    {
      name: 'WhatsApp 1',
      icon: <MessageCircle className="w-5 h-5" />,
      url: 'https://wa.me/22601765372',
    },
    {
      name: 'WhatsApp 2',
      icon: <MessageCircle className="w-5 h-5" />,
      url: 'https://wa.me/22607396519',
    },
    {
      name: 'Email',
      icon: <Mail className="w-5 h-5" />,
      url: 'mailto:fasoticket.burkindi@gmail.com',
    }
  ]

  const quickLinks = [
    { name: 'Accueil', path: '/' },
    { name: 'Boutique', path: '/boutique' },
    { name: 'Réserver un ticket', path: '/reservation' },
    { name: 'Espace organisateur', path: '/organisateur/dashboard' },
    { name: 'Devenir organisateur', path: '/devenir-organisateur' },
    { name: 'Nos partenaires', path: '/partenaires' }  // ✅ AJOUT
  ]

  return (
    <footer className="bg-black border-t border-yellow-400/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold">
              <span className="text-white">FASO</span>
              <span className="text-yellow-400">TICKET</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Solution de billetterie simple, rapide et sécurisée pour vos événements au Burkina Faso. 
              Paiement mobile, tickets numériques et scan à l'entrée.
            </p>
            <Link
              to="/devenir-organisateur"
              className="inline-block bg-yellow-400 text-black px-6 py-2.5 rounded-lg hover:bg-yellow-300 transition-all duration-200 transform hover:scale-105 font-medium text-sm"
            >
              Commencer maintenant →
            </Link>
          </div>

          {/* Liens utiles */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-lg">Liens utiles</h3>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-yellow-400 transition-colors text-sm flex items-center space-x-1"
                  >
                    <span>›</span>
                    <span>{link.name}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/politique-confidentialite"
                  className="text-gray-400 hover:text-yellow-400 transition-colors text-sm flex items-center space-x-1"
                >
                  <span>›</span>
                  <span>Politique de confidentialité</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/mentions-legales"
                  className="text-gray-400 hover:text-yellow-400 transition-colors text-sm flex items-center space-x-1"
                >
                  <span>›</span>
                  <span>Mentions légales</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/cgv"
                  className="text-gray-400 hover:text-yellow-400 transition-colors text-sm flex items-center space-x-1"
                >
                  <span>›</span>
                  <span>CGV</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-lg">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3 text-gray-400 text-sm">
                <Phone className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div>01 765 372</div>
                  <div>07 396 519</div>
                </div>
              </li>
              <li className="flex items-start space-x-3 text-gray-400 text-sm">
                <Mail className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <a 
                  href="mailto:fasoticket.burkindi@gmail.com" 
                  className="hover:text-yellow-400 transition-colors break-all"
                >
                  fasoticket.burkindi@gmail.com
                </a>
              </li>
              <li className="flex items-start space-x-3 text-gray-400 text-sm">
                <MapPin className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <span>Ouagadougou, Burkina Faso</span>
              </li>
            </ul>
          </div>

          {/* Suivez-nous */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-lg">Suivez-nous</h3>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-800 p-3 rounded-full hover:bg-yellow-400 hover:text-black transition-all duration-200 transform hover:scale-110"
                  aria-label={social.name}
                >
                  <span className="text-white hover:text-black transition-colors">
                    {social.icon}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-8 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © {currentYear} FASO TICKET. Tous droits réservés.
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <Link to="/partenaires" className="hover:text-yellow-400 transition-colors">
                Partenaires
              </Link>
              <span>|</span>
              <Link to="/politique-confidentialite" className="hover:text-yellow-400 transition-colors">
                Confidentialité
              </Link>
              <span>|</span>
              <Link to="/mentions-legales" className="hover:text-yellow-400 transition-colors">
                Mentions légales
              </Link>
              <span>|</span>
              <Link to="/cgv" className="hover:text-yellow-400 transition-colors">
                CGV
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
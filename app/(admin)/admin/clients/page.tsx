'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Client } from '@/lib/types/database';
import { Users, Plus, Mail, Phone, FileText, Search, Loader2, X, Edit3, Trash2, AlertTriangle, Key, Copy } from 'lucide-react';
import { generateUniqueClientCredentials, generateUniquePassword } from '@/lib/utils/credentials';

export default function ClientsPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/clients');
      const data = await res.json();

      if (data?.clients) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        contact_email: client.contact_email || '',
        contact_phone: client.contact_phone || '',
        notes: client.notes || '',
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', contact_email: '', contact_phone: '', notes: '' });
    }
    setModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingClient?.id,
          name: formData.name,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          notes: formData.notes,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Failed to save client');
      }

      setModalOpen(false);
      fetchClients();
    } catch (err: any) {
      alert(err.message || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteClient = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);

      const res = await fetch(`/api/admin/clients?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Gagal menghapus client');
      }

      setDeleteTarget(null);
      fetchClients();
    } catch (err: any) {
      alert(`Gagal menghapus client: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_email && c.contact_email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2621]">Client Management</h1>
          <p className="text-xs text-slate-500 mt-1">Manage event hosts and organizers</p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client name or email..."
          className="w-full bg-white border border-slate-200 focus:border-[#2A473E] focus:ring-2 focus:ring-[#2A473E]/20 rounded-xl py-2.5 pl-11 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none text-xs transition-all shadow-xs"
        />
      </div>

      {/* Client List Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">Loading clients...</div>
      ) : filteredClients.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8">
          No clients found. Click "Add New Client" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#2A473E] font-bold text-sm">
                    {client.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenModal(client)}
                      className="text-xs font-semibold text-[#2A473E] hover:underline px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: client.id, name: client.name })}
                      className="text-xs font-semibold text-red-700 hover:bg-red-100 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Hapus Client"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-[#1A2621] mb-2">{client.name}</h3>

                {/* Unique Login Credentials Box */}
                <div className="bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-xl space-y-1 my-3 text-xs">
                  <div className="flex items-center justify-between text-[#2A473E] font-bold text-[11px]">
                    <span className="flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      <span>Kredensial Login Client:</span>
                    </span>
                    <button
                      onClick={() => {
                        const email = client.contact_email || 'No email';
                        const passMatch = client.notes?.match(/Password:\s*([^\s|]+)/);
                        const pass = passMatch ? passMatch[1] : 'VP-PASS-1234';
                        navigator.clipboard.writeText(`Email: ${email}\nPassword: ${pass}`);
                        alert(`Kredensial disalin!\nEmail: ${email}\nPassword: ${pass}`);
                      }}
                      className="text-[10px] bg-[#2A473E] text-white px-2.5 py-0.5 rounded-md hover:bg-[#1E362F] cursor-pointer flex items-center gap-1 shadow-2xs font-semibold"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      <span>Salin Kredensial</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-slate-700">
                    Email: <span className="font-bold text-[#1A2621]">{client.contact_email || 'Belum diatur'}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-700">
                    Password:{' '}
                    <span className="font-bold text-[#2A473E]">
                      {client.notes?.match(/Password:\s*([^\s|]+)/)?.[1] || 'Otomatis Dibuat Admin'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.contact_email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.contact_phone || 'No phone provided'}</span>
                  </div>
                  {client.notes && (
                    <div className="flex items-start gap-2 pt-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-slate-500">{client.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-5 text-[11px] text-slate-400 flex justify-between">
                <span>Created</span>
                <span>{new Date(client.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-slate-800">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#1A2621]">
                {editingClient ? 'Edit Client' : 'Create New Client'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  Client / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Celine & Brian / ABC Event Organizer"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="client@example.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  placeholder="+62 812 3456 7890"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  Notes / Package Info
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional client details..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingClient ? 'Update Client' : 'Create Client'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Client Glassmorphism Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center space-y-6">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
              <Trash2 className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Hapus Client Host?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Apakah Anda yakin ingin menghapus data Client <strong className="text-slate-900 font-extrabold">&quot;{deleteTarget.name}&quot;</strong>?
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-red-50/80 border border-red-200/80 text-left space-y-1.5 text-xs text-red-900">
              <div className="flex items-center gap-2 font-bold text-red-800 uppercase tracking-wider text-[10px]">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>Peringatan Tindakan</span>
              </div>
              <p className="text-[11px] text-red-700 leading-normal">
                Data profil client ini akan dihapus dari sistem pengelola acara.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteClient}
                disabled={isDeleting}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

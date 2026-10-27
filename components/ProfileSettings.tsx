import React, { useState, useRef } from 'react';
import { User } from '../types';
import { X, Camera, Loader2, Save, User as UserIcon } from 'lucide-react';
import { updateUserProfile, uploadAvatar } from '../api/fieldManagerApi';

interface ProfileSettingsProps {
    user: User;
    onClose: () => void;
    onUpdate: (updatedUser: User) => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, onClose, onUpdate }) => {
    const [name, setName] = useState(user.name);
    const [avatarUrl, setAvatarUrl] = useState(user.avatar);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Por favor, selecione uma imagem válida.');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setError('A imagem deve ter no máximo 2MB.');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const url = await uploadAvatar(user.id, file);
            setAvatarUrl(url);
        } catch (err: any) {
            console.error('Error uploading avatar:', err);
            setError('Erro ao fazer upload da imagem.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('O nome não pode estar vazio.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const updatedUser = await updateUserProfile(user.id, {
                name: name.trim(),
                avatar: avatarUrl
            });
            onUpdate(updatedUser);
            onClose();
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError('Erro ao salvar as alterações.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#141518]/40 backdrop-blur-xs" onClick={onClose} />

            <div className="relative w-full max-w-md ooh-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-[#E6E8EC] flex justify-between items-center">
                    <div>
                        <h2 className="font-display text-xl font-bold text-[#141518]">Meu Perfil</h2>
                        <p className="text-xs text-[#525866] mt-0.5">Gerencie seus dados de identificação</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#525866] hover:text-[#141518] hover:bg-[#F4F5F7] transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#E6E8EC] bg-[#F4F5F7] flex items-center justify-center relative">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon size={36} className="text-[#868C98]" />
                                )}

                                {uploading && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 text-[#FF4F00] animate-spin" />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="absolute bottom-0 right-0 p-2 bg-[#141518] hover:bg-[#FF4F00] text-white rounded-full shadow-md transition-colors"
                            >
                                <Camera size={15} />
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                        <p className="text-xs text-[#868C98] text-center">
                            Clique na câmera para atualizar sua foto (máx. 2MB)
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-[#525866]">Nome Completo</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#868C98]" size={16} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="ooh-input w-full pl-10 pr-4"
                                    placeholder="Seu nome"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-[#525866]">E-mail Corporativo</label>
                            <div className="ooh-input w-full flex items-center text-[#868C98] bg-[#ECEEF2]/60 cursor-not-allowed">
                                {user.email}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-[#E6E8EC] text-xs font-semibold text-[#525866] hover:text-[#141518] hover:bg-[#F4F5F7] transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || uploading}
                            className="px-5 py-2.5 rounded-xl bg-[#141518] hover:bg-[#FF4F00] text-white font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

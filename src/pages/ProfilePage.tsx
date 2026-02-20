import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Avatar, Button, Group, Stack, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { ChevronRight, CircleHelp, LogOut, Settings, Shield } from 'lucide-react';
import { supabase, uploadImageAndGetPublicUrl } from '../lib/supabase';
import { useAuth } from '../state/AuthContext';

type MenuKey = 'account' | 'help' | 'privacy';

const menuItems: Array<{ key: MenuKey; label: string; icon: typeof Settings }> = [
  { key: 'account', label: 'Configuracao de conta', icon: Settings },
  { key: 'help', label: 'Obtenha ajuda', icon: CircleHelp },
  { key: 'privacy', label: 'Ver perfil e privacidade', icon: Shield },
];

export function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [activeMenu, setActiveMenu] = useState<MenuKey>('account');
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setCpf(profile?.cpf ?? '');
    setBirthDate(profile?.birth_date ?? '');
  }, [profile]);

  const displayName = useMemo(() => {
    const fallback = profile?.email?.split('@')[0] || 'Seu perfil';
    return (profile?.name || fallback).trim();
  }, [profile?.email, profile?.name]);

  const onSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          phone: phone.trim(),
          cpf: cpf.trim(),
          birth_date: birthDate || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao salvar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const onAvatarSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setErrorMessage('');

    try {
      const path = `${user.id}/avatar/${Date.now()}.jpg`;
      const url = await uploadImageAndGetPublicUrl(file, path);

      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw error;

      await refreshProfile();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao subir avatar');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Stack gap="lg" py="md" className="profile-clean-page">
      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Stack align="center" gap={6} className="profile-clean-header">
        <label className="profile-clean-avatar-label" aria-label="Alterar foto de perfil">
          <Avatar src={profile?.avatar_url || '/logoapp.png'} size={108} radius="50%" />
          <input type="file" accept="image/*" onChange={onAvatarSelected} hidden />
        </label>

        <Title order={2} className="profile-clean-name">
          {displayName}
        </Title>

        <Text c="dimmed" size="sm">
          {profile?.email || '-'}
        </Text>

        <Text c="dimmed" size="xs">
          Toque na foto para alterar
        </Text>

        {avatarUploading ? (
          <Text size="xs" c="dimmed">
            Enviando foto...
          </Text>
        ) : null}
      </Stack>

      <Stack gap={0} className="profile-clean-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = activeMenu === item.key;

          return (
            <UnstyledButton
              key={item.key}
              className={`profile-clean-menu-item ${active ? 'active' : ''}`}
              onClick={() => setActiveMenu(item.key)}
            >
              <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <span className="profile-clean-menu-icon" aria-hidden>
                    <Icon size={16} />
                  </span>
                  <Text fw={600}>{item.label}</Text>
                </Group>

                <ChevronRight size={16} />
              </Group>
            </UnstyledButton>
          );
        })}
      </Stack>

      {activeMenu === 'account' ? (
        <form onSubmit={onSaveProfile} className="profile-clean-panel">
          <Stack gap="sm">
            <TextInput label="Nome" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
            <TextInput
              label="Telefone"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              required
            />
            <TextInput label="CPF" value={cpf} onChange={(event) => setCpf(event.currentTarget.value)} />
            <TextInput
              label="Nascimento (YYYY-MM-DD)"
              value={birthDate}
              onChange={(event) => setBirthDate(event.currentTarget.value)}
            />

            <Button type="submit" loading={savingProfile} radius="xl">
              Salvar configuracao
            </Button>
          </Stack>
        </form>
      ) : null}

      {activeMenu === 'help' ? (
        <Stack gap="sm" className="profile-clean-panel">
          <Text size="sm" c="dimmed">
            Suporte e informacoes da sua conta.
          </Text>

          <Button component={Link} to="/app/chat" variant="default" radius="xl">
            Abrir chat
          </Button>
          <Button component={Link} to="/termos-de-uso" variant="default" radius="xl">
            Termos de uso
          </Button>
          <Button component={Link} to="/politica-de-privacidade" variant="default" radius="xl">
            Politica de privacidade
          </Button>
        </Stack>
      ) : null}

      {activeMenu === 'privacy' ? (
        <Stack gap="sm" className="profile-clean-panel">
          <Text size="sm">Nome publico: {displayName}</Text>
          <Text size="sm">E-mail da conta: {profile?.email || '-'}</Text>
          <Text size="sm">Telefone: {profile?.phone || '-'}</Text>

          <Button component={Link} to="/politica-de-privacidade" variant="default" radius="xl">
            Ver politica de privacidade
          </Button>

          <Button color="red" variant="light" leftSection={<LogOut size={16} />} onClick={() => void signOut()} radius="xl">
            Sair da conta
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}

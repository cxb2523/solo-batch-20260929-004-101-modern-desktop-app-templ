import { Stack, Switch, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useCompactLayout } from '../store/preferences';

export default function Settings() {
	const { t } = useTranslation();
	// single source of truth: the same store drives this switch and the app layout
	const [compactLayout, setCompactLayout] = useCompactLayout();

	return (
		<Stack gap={compactLayout ? 'xs' : 'md'} p={compactLayout ? 'xs' : 'md'} data-compact-layout={compactLayout || undefined}>
			<Title order={2}>{t('Settings')}</Title>
			<Switch
				id='compact-layout'
				checked={compactLayout}
				onChange={event => setCompactLayout(event.currentTarget.checked)}
				label={t('Compact layout')}
				description={t('Reduces spacing and padding throughout the app')}
				size={compactLayout ? 'sm' : 'md'}
			/>
			<Text size={compactLayout ? 'sm' : 'md'}>{t('Settings are stored locally and synced across tabs')}</Text>
		</Stack>
	);
}

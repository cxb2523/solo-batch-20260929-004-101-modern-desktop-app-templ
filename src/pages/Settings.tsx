import { Stack, Switch, Text, Title } from '@mantine/core';
import { setPreference, usePreferences } from '../store/preferences';

export default function Settings() {
	const preferences = usePreferences();

	return <Stack gap={preferences.compactLayout ? 'xs' : 'md'}>
		<Title order={2}>Settings</Title>
		<Switch
			id='compact-layout'
			label='紧凑布局'
			description='缩小界面间距与留白'
			checked={preferences.compactLayout}
			onChange={event => setPreference('compactLayout', event.currentTarget.checked)}
		/>
		<Text size='sm' c='dimmed'>布局偏好会自动保存并同步到其他标签页。</Text>
	</Stack>;
}

import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/src/components/haptic-tab';
import { Colors } from '@/src/constants/theme';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { Home, MessageCircle, Search, Send, SquarePlus } from 'lucide-react-native';
import { View } from 'react-native';
const SIZE = 24;
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.68)',
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopWidth: 0,
        },
        headerShown: false,
        tabBarButton: HapticTab,

      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Search size={SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plus"
        options={{
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              style={[
                props.style,
                {
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%', // 撑满整个 TabBar 高度
                },
              ]}
            >
              {/* 这里用一个 View 包裹你的图标，可以用 Uniwind 随意调样式 */}
              <View className="justify-center items-center active:scale-95">
                <SquarePlus size={34} color={props.accessibilityState?.selected ? Colors[colorScheme ?? 'light'].tint : '#9ca3af'} />
              </View>
            </HapticTab>
          ),
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          title: 'Message',
          tabBarIcon: ({ color }) => <MessageCircle size={SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Send size={SIZE} color={color} />,
        }}
      />
      {/* <Send /> */}
    </Tabs>
  );
}

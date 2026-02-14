// Model Picker — lets users choose which AI model generates drafts
// Appears as a compact button in the chat composer, opens a dropdown of available models

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { ChevronDown, Check, Cpu, Zap } from 'lucide-react-native';
import Animated, { FadeOut, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  AI_MODELS,
  type AIModel,
  getAvailableModels,
  getSelectedModel,
  setSelectedModel,
} from '@/lib/ai-keys';

interface ModelPickerProps {
  compact?: boolean;
}

export function ModelPicker({ compact = true }: ModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadModels = useCallback(async () => {
    setLoading(true);
    const models = await getAvailableModels();
    const selected = await getSelectedModel();
    setAvailableModels(models);
    setSelectedModelId(selected);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleSelectModel = async (model: AIModel | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newId = model?.id || null;
    setSelectedModelId(newId);
    await setSelectedModel(newId);
    setIsOpen(false);
  };

  const selectedModel = selectedModelId
    ? AI_MODELS.find(m => m.id === selectedModelId) || null
    : null;

  const displayName = selectedModel?.name || 'Auto';
  const displayColor = selectedModel?.color || '#64748B';

  if (loading) return null;
  if (availableModels.length <= 1) return null; // No point showing picker with 0–1 model

  return (
    <>
      {/* Compact Button */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          loadModels(); // Refresh available models on open
          setIsOpen(true);
        }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: compact ? 4 : 6,
          borderRadius: 20,
          backgroundColor: 'rgba(30, 41, 59, 0.8)',
          borderWidth: 1,
          borderColor: 'rgba(100, 116, 139, 0.3)',
          marginRight: 8,
          alignSelf: 'center',
        })}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: displayColor,
            marginRight: 5,
          }}
        />
        <Text
          style={{
            color: '#CBD5E1',
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <ChevronDown size={10} color="#64748B" style={{ marginLeft: 3 }} />
      </Pressable>

      {/* Model Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setIsOpen(false)}
        >
          <Animated.View
            entering={SlideInDown.duration(250)}
            exiting={FadeOut.duration(150)}
            style={{
              backgroundColor: '#0F172A',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 40,
              borderTopWidth: 1,
              borderColor: 'rgba(100, 116, 139, 0.3)',
            }}
          >
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Cpu size={16} color="#F97316" />
                <Text style={{
                  color: '#F1F5F9',
                  fontSize: 16,
                  fontWeight: '700',
                  marginLeft: 8,
                }}>
                  Choose Model
                </Text>
              </View>
              <Pressable
                onPress={() => setIsOpen(false)}
                style={{ padding: 4 }}
              >
                <Text style={{ color: '#64748B', fontSize: 14 }}>Done</Text>
              </Pressable>
            </View>

            {/* Handle bar */}
            <View style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              marginLeft: -20,
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(100, 116, 139, 0.4)',
            }} />

            {/* Auto option */}
            <Pressable
              onPress={() => handleSelectModel(null)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 14,
                backgroundColor: pressed ? 'rgba(100, 116, 139, 0.1)' : 'transparent',
              })}
            >
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(100, 116, 139, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Zap size={16} color="#94A3B8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F1F5F9', fontSize: 15, fontWeight: '600' }}>
                  Auto
                </Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 1 }}>
                  Use default provider order
                </Text>
              </View>
              {!selectedModelId && (
                <Check size={18} color="#F97316" />
              )}
            </Pressable>

            {/* Divider */}
            <View style={{
              height: 1,
              backgroundColor: 'rgba(100, 116, 139, 0.15)',
              marginHorizontal: 20,
              marginVertical: 4,
            }} />

            {/* Available Models */}
            {availableModels.map((model) => (
              <Pressable
                key={model.id}
                onPress={() => handleSelectModel(model)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  backgroundColor: pressed ? 'rgba(100, 116, 139, 0.1)' : 'transparent',
                })}
              >
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: `${model.color}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <View style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: model.color,
                  }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontSize: 15, fontWeight: '600' }}>
                    {model.name}
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 1 }}>
                    {model.description}
                  </Text>
                </View>
                {selectedModelId === model.id && (
                  <Check size={18} color="#F97316" />
                )}
              </Pressable>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

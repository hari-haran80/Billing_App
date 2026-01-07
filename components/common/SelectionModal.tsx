import { useTheme } from "@/constants/ThemeContext";
import React, { useMemo, useState } from "react";
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface SelectionItem {
    label: string;
    value: any;
    subtitle?: string;
}

interface SelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (value: any) => void;
    title: string;
    items: SelectionItem[];
    searchable?: boolean;
    selectedValue?: any;
}

export function SelectionModal({
    visible,
    onClose,
    onSelect,
    title,
    items,
    searchable = false,
    selectedValue,
}: SelectionModalProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredItems = useMemo(() => {
        if (!searchQuery) return items;
        return items.filter((item) =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const renderItem = ({ item }: { item: SelectionItem }) => {
        const isSelected = item.value === selectedValue;
        return (
            <TouchableOpacity
                style={[
                    styles.itemContainer,
                    isSelected && { backgroundColor: colors.primary + "10" },
                ]}
                onPress={() => {
                    onSelect(item.value);
                    onClose();
                }}
            >
                <View style={styles.itemContent}>
                    <Text
                        style={[
                            styles.itemLabel,
                            isSelected && { color: colors.primary, fontWeight: "bold" },
                        ]}
                    >
                        {item.label}
                    </Text>
                    {item.subtitle && (
                        <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                    )}
                </View>
                {isSelected && <Icon name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Icon name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {searchable && (
                        <View style={styles.searchContainer}>
                            <Icon name="search" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery("")}>
                                    <Icon name="close" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <FlatList
                        data={filteredItems}
                        renderItem={renderItem}
                        keyExtractor={(item, index) => index.toString()}
                        contentContainerStyle={styles.listContent}
                        ItemSeparatorComponent={() => (
                            <View style={[styles.separator, { backgroundColor: colors.border }]} />
                        )}
                        keyboardShouldPersistTaps="handled"
                    />
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 20,
        },
        modalContainer: {
            backgroundColor: colors.cardBackground,
            borderRadius: 12,
            maxHeight: "80%",
            width: "100%",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
        },
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
        },
        title: {
            fontSize: 18,
            fontWeight: "bold",
        },
        closeButton: {
            padding: 4,
        },
        searchContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.inputBackground,
            margin: 16,
            marginTop: 0,
            paddingHorizontal: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            height: 48,
        },
        searchInput: {
            flex: 1,
            marginLeft: 8,
            fontSize: 16,
            height: "100%",
        },
        listContent: {
            paddingVertical: 8,
        },
        itemContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 16,
        },
        itemContent: {
            flex: 1,
        },
        itemLabel: {
            fontSize: 16,
            color: colors.text,
        },
        itemSubtitle: {
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 2,
        },
        separator: {
            height: 1,
            marginLeft: 16,
        },
    });

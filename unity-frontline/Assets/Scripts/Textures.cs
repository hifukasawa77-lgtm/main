// Generated bitmap albedo assets; shared by all characters and world props.
using UnityEngine;
public static class Textures
{
    public static Texture2D Ground, CamoAzure, CamoEmber, MetalAzure, MetalEmber, MetalDark, MetalRust,
        Concrete, Sandbag, Crate, Cloth, Crater, Bark, Burnt, Skin;
    static bool ready;
    static Texture2D Load(string name)
    {
        var texture = Resources.Load<Texture2D>("FrontlineTextures/" + name);
        if (texture == null) throw new System.InvalidOperationException("Missing generated texture: " + name);
        return texture;
    }
    public static void Init()
    {
        if (ready) return;
        Ground = Load("Ground");
        CamoAzure = Load("CamoAzure");
        CamoEmber = Load("CamoEmber");
        MetalAzure = Load("MetalAzure");
        MetalEmber = Load("MetalEmber");
        MetalDark = Load("MetalDark");
        MetalRust = Load("MetalRust");
        Concrete = Load("Concrete");
        Sandbag = Load("Sandbag");
        Crate = Load("Crate");
        Cloth = Load("Cloth");
        Crater = Load("Crater");
        Bark = Load("Bark");
        Burnt = Load("Burnt");
        Skin = Load("Skin");
        ready = true;
    }
}
